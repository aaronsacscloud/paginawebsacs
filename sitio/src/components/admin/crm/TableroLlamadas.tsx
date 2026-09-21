/* LO QUE SALIÓ DE LLAMAR · cuatro listas, no seis cifras.
 *
 * PEDIDO DEL DUEÑO (21-sep-2026): «quita los cards que aparecen de KPIs y sólo
 * vamos a agregar un data table que muestre en tabs: reuniones agendadas (por
 * llamada inteligente, que son próximas); en otro, llamadas de seguimiento
 * próximas; en otro, oportunidades (que se generaron por las llamadas
 * inteligentes, pero que aparezcan los datos de los usuarios); y otro tab que
 * muestre las listas generadas y el status de cada una, si falta reanudar
 * alguna. Y todo eso que sea fácil de entender».
 *
 * POR QUÉ ES MEJOR QUE LO QUE HABÍA. Las tarjetas decían «24 conversaciones ·
 * 96 minutos · 8 citas» y con eso no se podía hacer nada: informan cómo vas,
 * no a quién le toca. Cada renglón de aquí es una persona con nombre y un
 * siguiente paso — y el que se pueda ordenar, buscar y filtrar es la
 * diferencia entre mirar la pantalla y trabajar desde ella.
 *
 * CADA PESTAÑA CONTESTA UNA PREGUNTA, en el orden en que uno se las hace al
 * llegar en la mañana:
 *   ¿A quién voy a ver?           · Reuniones
 *   ¿A quién le dije que llamo?   · Seguimientos  (las vencidas primero)
 *   ¿Quién avanzó por llamarle?   · Oportunidades
 *   ¿Qué lista dejé a medias?     · Listas
 *
 * Las cuatro sobre `TablaEnterprise`, que es el estándar de datatables del CRM
 * (buscador, filtros, orden, paginación) — con `sinVistas`: las pestañas de
 * aquí son CUATRO CONJUNTOS DISTINTOS, no cuatro vistas del mismo, y encimar
 * las suyas encima de éstas daría dos tiras de pestañas que significan cosas
 * diferentes a dos centímetros una de otra.
 */
import { useEffect, useMemo, useState } from 'react';
import TablaEnterprise, { type ColDef, type VistaDef } from './TablaEnterprise';
import { useIsMobile } from '../../../lib/ui/mobile';

const P = { violeta: '#9B8CFA', violetaTinta: '#5B4BD6', agua: '#EEECFE', verde: '#1E8A63', verdeAgua: '#EAF8F2', ambar: '#9a6a10', ambarAgua: '#FFF4E5', rojo: '#C0554E', rojoAgua: '#FDF0EE', gris: '#6b7280' };

const VISTA_UNICA: VistaDef[] = [{ key: 'todos', nombre: 'Todos', config: {} }];

const pill = (fondo: string, tinta: string) => ({
  fontSize: 10.5, fontWeight: 800, borderRadius: 999, padding: '2px 8px',
  background: fondo, color: tinta, whiteSpace: 'nowrap' as const, display: 'inline-block',
});

/* ── EL ESTILO DE CELDA, A MANO Y A PROPÓSITO ──────────────────────────────
   `TablaEnterprise` sólo aplica su `E.td` —padding, tipografía, la línea de
   abajo— cuando ella misma dibuja la celda. Si el `render` de la columna
   devuelve un `<td style={TD}>` (que es como se hace aquí, para que la celda pueda leer
   el estado del padre), le clona el estilo propio y nada más: las celdas salen
   sin padding y sin borde, y en la primera prueba el correo de un contacto se
   montaba encima de la columna de al lado. Se replica aquí, una vez, y todas
   las celdas lo usan.
   `verticalAlign: top` y no `middle`: en esta tabla hay celdas de tres líneas
   (la nota de la llamada) junto a otras de una, y centrarlas deja el nombre
   flotando a media altura sin nada al lado. */
const TD = {
  padding: '11px 14px', fontSize: '0.78rem', color: '#3a3a44',
  borderBottom: '1px solid #f1f1f4', verticalAlign: 'top' as const,
  wordBreak: 'break-word' as const,
};

const dineroMX = (n?: number | null) => (n == null ? '—' : `$${Number(n).toLocaleString('es-MX', { maximumFractionDigits: 0 })}`);

/** «lun 22 · 16:00», que es como se dice una cita en voz alta. */
function fechaCorta(iso?: string | null, hora?: string | null) {
  if (!iso) return '—';
  const d = new Date(`${String(iso).slice(0, 10)}T12:00:00`);
  const dia = new Intl.DateTimeFormat('es-MX', { weekday: 'short', day: 'numeric', month: 'short' }).format(d).replace(/\./g, '');
  return hora ? `${dia} · ${hora}` : dia;
}
function cuandoLargo(iso?: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${new Intl.DateTimeFormat('es-MX', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'America/Mexico_City' }).format(d).replace(/\./g, '')} · ${d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Mexico_City' })}`;
}

/* ── EN EL TELÉFONO, TARJETAS ─────────────────────────────────────────────
   Una tabla de ocho columnas en 390 px se convierte en un carrusel horizontal:
   se puede mirar, no se puede trabajar. `TablaEnterprise` acepta pintar cada
   fila como tarjeta en móvil respetando los MISMOS filtros y orden, así que
   cada pestaña trae la suya con lo único que se decide desde el teléfono:
   quién, cuándo y la señal de alarma. El resto se ve al abrir la ficha. */
const Tarjeta = ({ alto, bajo, derecha, pie }: { alto: any; bajo?: any; derecha?: any; pie?: any }) => (
  <div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontWeight: 800, fontSize: '0.92rem' }}>{alto}</div>
        {bajo && <div style={{ fontSize: '0.76rem', color: '#8a8f98', marginTop: 2 }}>{bajo}</div>}
      </div>
      {derecha}
    </div>
    {pie && <div style={{ display: 'flex', gap: 7, alignItems: 'center', flexWrap: 'wrap', marginTop: 8 }}>{pie}</div>}
  </div>
);

const ETAPA_LABEL: Record<string, string> = { oportunidad: 'Oportunidad', en_cotizacion: 'En cotización', cliente: 'Cliente' };

type Props = {
  /** Abrir una jornada en la cabina (la misma acción de «Seguir»). */
  onAbrirSesion: (id: string) => void;
};

export default function TableroLlamadas({ onAbrirSesion }: Props) {
  const esMovil = useIsMobile();
  const [d, setD] = useState<any>(null);
  const [error, setError] = useState<string>('');
  const [tab, setTab] = useState<'reuniones' | 'seguimientos' | 'oportunidades' | 'descalificados' | 'listas'>('reuniones');
  /* Los seguimientos vencidos NO se mezclan con los de hoy: la pestaña es para
     decidir a quién le toca ahora. Pero tampoco se esconden — un botón los
     trae, con su número siempre a la vista. */
  const [verVencidos, setVerVencidos] = useState(false);

  useEffect(() => {
    let vivo = true;
    fetch('/api/crm/telefonia/tablero', { cache: 'no-store' })
      .then(r => r.json())
      .then(j => { if (!vivo) return; if (j?.ok) setD(j); else setError(j?.error || 'No se pudo cargar'); })
      .catch(e => { if (vivo) setError(String(e?.message || e)); });
    return () => { vivo = false; };
  }, []);

  const irAlContacto = (contactId?: string | null) => {
    if (contactId) window.location.href = `/admin/crm?tab=pipeline&lead=${contactId}`;
  };

  // ── Columnas ──────────────────────────────────────────────────────────────
  const colsReuniones: ColDef[] = useMemo(() => [
    {
      key: 'cuando', label: 'Cuándo', width: 160, fija: true,
      val: (r: any) => `${r.fecha} ${r.hora}`,
      render: (r: any) => (
        <td style={{ ...TD, fontWeight: 800, color: r.es_hoy ? P.rojo : P.violetaTinta }}>
          <div style={{ whiteSpace: 'nowrap' }}>{fechaCorta(r.fecha, r.hora)}</div>
          {r.es_hoy && <div style={{ marginTop: 3 }}><span style={pill(P.rojoAgua, P.rojo)}>hoy</span></div>}
        </td>
      ),
    },
    { key: 'quien', label: 'Con quién', val: (r: any) => r.quien, render: (r: any) => (
      <td style={TD}><b>{r.quien}</b>{r.empresa && <div style={{ fontSize: 11.5, color: P.gris }}>{r.empresa}</div>}</td>
    ) },
    { key: 'tipo', label: 'Tipo', ftype: 'select', val: (r: any) => r.tipo, render: (r: any) => <td style={TD}>{r.tipo}</td> },
    { key: 'host', label: 'Quién la da', ftype: 'select', val: (r: any) => r.host, render: (r: any) => <td style={TD}>{r.host}</td> },
    {
      /* La columna que más citas salva: sin evento de Google no le suena a
         nadie, ni al cliente ni a quien la da. Por eso es una alarma, no un
         dato más. */
      key: 'en_google', label: 'En el calendario', ftype: 'select',
      options: [{ v: 'sí', l: 'Sí' }, { v: 'no', l: 'No' }],
      val: (r: any) => (r.en_google ? 'sí' : 'no'),
      render: (r: any) => (
        <td style={TD}>{r.en_google
          ? <span style={pill(P.verdeAgua, P.verde)}>En Google Calendar</span>
          : <span style={pill(P.ambarAgua, P.ambar)}>⚠️ No le va a sonar a nadie</span>}</td>
      ),
    },
    {
      key: 'estado', label: 'Estado', ftype: 'select', val: (r: any) => r.estado,
      render: (r: any) => (
        <td style={{ ...TD, color: P.gris }}>
          {r.estado}
          {/* «A mano» = se habló por la cabina y la cita se agendó aparte.
              Cuenta igual, pero si empiezan a salir muchas es señal de que el
              cierre con IA está fallando — que es justo lo que pasó con la
              demo de Maela Sport. */}
          {r.atribucion === 'a_mano' && (
            <div style={{ marginTop: 3 }}>
              <span title="Se habló por la cabina y la cita se agendó a mano" style={pill(P.agua, P.violetaTinta)}>agendada a mano</span>
            </div>
          )}
        </td>
      ),
    },
  ], []);

  const colsSeguimientos: ColDef[] = useMemo(() => [
    {
      key: 'cuando', label: 'Cuándo', width: 190, fija: true,
      val: (r: any) => r.cuando,
      /* La marca de «vencida» en su propio renglón y no al lado de la fecha:
         pegada, la columna se pasaba de ancho y la píldora salía cortada por
         el borde de la columna pegajosa. */
      render: (r: any) => (
        <td style={{ ...TD, fontWeight: 800, color: r.vencida ? P.rojo : P.violetaTinta }}>
          <div style={{ whiteSpace: 'nowrap' }}>{cuandoLargo(r.cuando)}</div>
          {r.vencida && <div style={{ marginTop: 3 }}><span style={pill(P.rojoAgua, P.rojo)}>vencida</span></div>}
        </td>
      ),
    },
    { key: 'quien', label: 'A quién', val: (r: any) => r.quien || '', render: (r: any) => (
      <td style={TD}><b>{r.quien || 'Sin nombre'}</b>{r.telefono && <div style={{ fontSize: 11.5, color: P.gris }}>{r.telefono}</div>}</td>
    ) },
    { key: 'que', label: 'Qué prometiste', val: (r: any) => r.que, render: (r: any) => <td style={{ ...TD, lineHeight: 1.45 }}>{r.que}</td> },
    {
      key: 'tipo', label: 'Tipo', ftype: 'select', val: (r: any) => r.tipo,
      render: (r: any) => <td style={TD}><span style={pill(P.agua, P.violetaTinta)}>{r.tipo === 'llamada' ? 'Llamar' : 'Responder'}</span></td>,
    },
    { key: 'duenio', label: 'Quién lo debe', ftype: 'select', val: (r: any) => r.duenio, render: (r: any) => <td style={TD}>{r.duenio}</td> },
  ], []);

  const colsOportunidades: ColDef[] = useMemo(() => [
    { key: 'quien', label: 'Quién', width: 200, fija: true, val: (r: any) => r.quien, render: (r: any) => (
      <td style={TD}><b>{r.quien}</b>{r.empresa && <div style={{ fontSize: 11.5, color: P.gris }}>{r.empresa}</div>}</td>
    ) },
    {
      key: 'etapa', label: 'Etapa', ftype: 'select', val: (r: any) => r.etapa,
      render: (r: any) => <td style={TD}><span style={pill(r.etapa === 'cliente' ? P.verdeAgua : P.agua, r.etapa === 'cliente' ? P.verde : P.violetaTinta)}>{ETAPA_LABEL[r.etapa] || r.etapa}</span></td>,
    },
    { key: 'contacto', label: 'Cómo localizarlo', val: (r: any) => `${r.telefono || ''} ${r.email || ''}`, render: (r: any) => (
      <td style={{ ...TD, fontSize: 11.5, lineHeight: 1.5 }}>{r.telefono || '—'}{r.email && <div style={{ color: P.gris }}>{r.email}</div>}</td>
    ) },
    { key: 'giro', label: 'Qué vende', val: (r: any) => r.giro || '', render: (r: any) => (
      <td style={{ ...TD, fontSize: 11.5, lineHeight: 1.45 }}>{r.giro || '—'}{r.sucursales != null && <div style={{ color: P.gris }}>{r.sucursales} {r.sucursales === 1 ? 'tienda' : 'tiendas'}</div>}</td>
    ) },
    {
      /* Lo que hace que este renglón se entienda sin abrir nada: la primera
         línea de la nota que dejó el cierre con IA al colgar. */
      key: 'nota', label: 'Qué dijo en la llamada', width: 340,
      val: (r: any) => r.nota || '',
      render: (r: any) => (
        <td style={{ ...TD, fontSize: 11.5, color: '#4B5563' }}>
          {/* Tres líneas y corta: es el contexto para reconocer al contacto, no
              el contenido de la tabla. La nota entera está en su ficha. */}
          <span style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.45 } as any}>{r.nota || '—'}</span>
        </td>
      ),
    },
    { key: 'hablamos', label: 'Cuándo hablamos', width: 130, ftype: 'date', val: (r: any) => String(r.hablamos || '').slice(0, 10), render: (r: any) => (
      <td style={{ ...TD, whiteSpace: 'nowrap' }}>{fechaCorta(r.hablamos)}{r.minutos ? <div style={{ fontSize: 11, color: P.gris }}>{r.minutos} min</div> : null}</td>
    ) },
    { key: 'monto', label: 'Monto', num: true, ftype: 'number', val: (r: any) => r.monto || 0, render: (r: any) => (
      <td style={{ ...TD, textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{dineroMX(r.monto)}</td>
    ) },
    { key: 'duenio', label: 'Dueño', ftype: 'select', val: (r: any) => r.duenio, render: (r: any) => <td style={TD}>{r.duenio}</td> },
  ], []);

  /* Los descalificados reusan las columnas de oportunidades menos las dos que
     ahí no dicen nada —el monto y la etapa, que siempre es la misma— y con el
     porqué en su lugar. Pedido del dueño (21-sep-2026): «que aparezcan los
     descalificados para que yo pueda ver rápido aquí todos los que hemos
     descalificado a través de una llamada». */
  const colsDescalificados: ColDef[] = useMemo(() => [
    { key: 'quien', label: 'Quién', width: 200, fija: true, val: (r: any) => r.quien, render: (r: any) => (
      <td style={{ ...TD }}><b>{r.quien}</b>{r.empresa && <div style={{ fontSize: 11.5, color: P.gris }}>{r.empresa}</div>}</td>
    ) },
    { key: 'hablamos', label: 'Cuándo hablamos', width: 130, ftype: 'date', val: (r: any) => String(r.hablamos || '').slice(0, 10), render: (r: any) => (
      <td style={{ ...TD, whiteSpace: 'nowrap' }}>{fechaCorta(r.hablamos)}{r.minutos ? <div style={{ fontSize: 11, color: P.gris }}>{r.minutos} min</div> : null}</td>
    ) },
    {
      key: 'nota', label: 'Por qué se descartó', width: 420,
      val: (r: any) => `${r.motivo || ''} ${r.nota || ''}`,
      render: (r: any) => (
        <td style={{ ...TD, fontSize: 11.5, color: '#4B5563' }}>
          {r.motivo && <div style={{ marginBottom: 3 }}><span style={pill(P.ambarAgua, P.ambar)}>{r.motivo}</span></div>}
          <span style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.45 } as any}>{r.nota || 'Sin nota de la llamada.'}</span>
        </td>
      ),
    },
    { key: 'giro', label: 'Qué vende', val: (r: any) => r.giro || '', render: (r: any) => (
      <td style={{ ...TD, fontSize: 11.5, lineHeight: 1.45 }}>{r.giro || '—'}{r.sucursales != null && <div style={{ color: P.gris }}>{r.sucursales} {r.sucursales === 1 ? 'tienda' : 'tiendas'}</div>}</td>
    ) },
    { key: 'contacto', label: 'Cómo localizarlo', val: (r: any) => `${r.telefono || ''} ${r.email || ''}`, render: (r: any) => (
      <td style={{ ...TD, fontSize: 11.5, lineHeight: 1.5 }}>{r.telefono || '—'}{r.email && <div style={{ color: P.gris }}>{r.email}</div>}</td>
    ) },
    { key: 'duenio', label: 'Quién lo descartó', ftype: 'select', val: (r: any) => r.duenio, render: (r: any) => <td style={TD}>{r.duenio}</td> },
  ], []);

  const colsListas: ColDef[] = useMemo(() => [
    { key: 'nombre', label: 'Lista', width: 230, fija: true, val: (r: any) => r.nombre, render: (r: any) => (
      <td style={TD}><b>{r.nombre}</b><div style={{ fontSize: 11.5, color: P.gris }}>{fechaCorta(r.fecha)} · {r.duenio}</div></td>
    ) },
    {
      key: 'estado', label: 'Estado', ftype: 'select', val: (r: any) => r.estado,
      render: (r: any) => (
        <td style={TD}>
          <span style={pill(r.viva ? P.verdeAgua : '#f4f4f6', r.viva ? P.verde : '#4B5563')}>{r.estado}</span>
          {r.motivo_pausa && <div style={{ fontSize: 11, color: P.ambar, marginTop: 3 }}>{r.motivo_pausa}</div>}
        </td>
      ),
    },
    {
      /* La pregunta del dueño era literal: «si falta reanudar alguna». Se
         responde con el número de gente que nunca se marcó, no con el estado:
         una jornada «terminada» con 44 sin marcar también se puede retomar, y
         ésa es justo la que se pierde de vista. */
      key: 'faltan', label: 'Falta por marcar', num: true, ftype: 'number', val: (r: any) => r.faltan,
      render: (r: any) => (
        <td style={{ ...TD, textAlign: 'right' }}>
          {r.faltan > 0
            ? <span style={pill(P.ambarAgua, P.ambar)}>{r.faltan} sin marcar</span>
            : <span style={{ color: '#9ca3af' }}>—</span>}
        </td>
      ),
    },
    { key: 'total', label: 'En la lista', num: true, ftype: 'number', val: (r: any) => r.total, render: (r: any) => <td style={{ ...TD, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{r.total}</td> },
    { key: 'contestadas', label: 'Contestaron', num: true, ftype: 'number', val: (r: any) => r.contestadas, render: (r: any) => (
      <td style={{ ...TD, textAlign: 'right', fontWeight: 700, color: r.contestadas ? P.verde : '#9ca3af', fontVariantNumeric: 'tabular-nums' }}>{r.contestadas}</td>
    ) },
    { key: 'buzon', label: 'Buzón', num: true, ftype: 'number', val: (r: any) => r.buzon, render: (r: any) => <td style={{ ...TD, textAlign: 'right', color: P.gris, fontVariantNumeric: 'tabular-nums' }}>{r.buzon}</td> },
    { key: 'minutos', label: 'Minutos', num: true, ftype: 'number', val: (r: any) => r.minutos, render: (r: any) => <td style={{ ...TD, textAlign: 'right', color: P.gris, fontVariantNumeric: 'tabular-nums' }}>{r.minutos}</td> },
    {
      key: 'accion', label: '', width: 110,
      render: (r: any) => (
        <td style={{ ...TD, textAlign: 'right' }}>
          <button onClick={e => { e.stopPropagation(); onAbrirSesion(r.id); }}
            style={{ fontFamily: 'inherit', fontSize: 12, fontWeight: 700, cursor: 'pointer', background: '#fff', border: `1.5px solid ${P.violeta}`, color: P.violetaTinta, borderRadius: 8, padding: '5px 11px', whiteSpace: 'nowrap' }}>
            {r.reanudable ? 'Reanudar' : 'Ver'}
          </button>
        </td>
      ),
    },
  ], [onAbrirSesion]);

  if (error) {
    return (
      <div style={{ marginTop: 22, background: P.rojoAgua, border: '1px solid #f0c4bd', color: P.rojo, borderRadius: 10, padding: '11px 14px', fontSize: 12.5 }}>
        No se pudo cargar lo que salió de las llamadas: {error}
      </div>
    );
  }
  if (!d) {
    return <div style={{ marginTop: 22, color: '#9ca3af', fontSize: 12.5 }}>Cargando lo que salió de tus llamadas…</div>;
  }

  const c = d.conteos;
  const TABS = [
    { id: 'reuniones' as const, label: 'Reuniones', n: c.reuniones, pie: 'Las citas que salieron de llamar y todavía no pasan.', alerta: 0 },
    { id: 'seguimientos' as const, label: 'Seguimientos', n: c.seguimientos, pie: 'Lo que prometiste al hablar, de hoy y de los días que vienen.', alerta: c.seguimientos_vencidos },
    { id: 'oportunidades' as const, label: 'Oportunidades', n: c.oportunidades, pie: 'Quién avanzó después de que le llamaras, y qué dijo.', alerta: 0 },
    { id: 'descalificados' as const, label: 'Descalificados', n: c.descalificados, pie: 'A quién se descartó después de hablarle, y por qué. Aquí se ve si se está descartando de más.', alerta: 0 },
    { id: 'listas' as const, label: 'Listas', n: c.listas, pie: 'Cada jornada y qué le falta por marcar.', alerta: c.listas_reanudables },
  ];
  const activa = TABS.find(t => t.id === tab)!;

  return (
    <div style={{ marginTop: 26 }}>
      <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: '#999' }}>Lo que salió de llamar</span>

      {/* LAS PESTAÑAS, CON SU NÚMERO. Sin el contador, una pestaña vacía se
          confunde con una que no cargó — y el número en rojo es lo que hace
          que «6 vencidas» se vea desde la pestaña de al lado, sin tener que
          entrar a buscarla. */}
      <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
        {TABS.map(t => {
          const on = t.id === tab;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{
                fontFamily: 'inherit', cursor: 'pointer', borderRadius: 10, padding: esMovil ? '8px 12px' : '9px 15px',
                fontSize: 13, fontWeight: on ? 800 : 600, display: 'flex', alignItems: 'center', gap: 7,
                border: `1px solid ${on ? P.violeta : '#e6e4ec'}`, background: on ? P.agua : '#fff', color: on ? P.violetaTinta : '#4B5563',
              }}>
              {t.label}
              <span style={pill(on ? '#fff' : '#f4f4f6', on ? P.violetaTinta : '#6b7280')}>{t.n}</span>
              {t.alerta > 0 && <span style={pill(P.rojoAgua, P.rojo)}>{t.alerta}</span>}
            </button>
          );
        })}
      </div>
      <p style={{ fontSize: 12, color: '#6b7280', margin: '9px 0 10px', lineHeight: 1.5 }}>{activa.pie}</p>

      {tab === 'reuniones' && (
        <TablaEnterprise tabla="tel_reuniones" data={d.reuniones} cols={colsReuniones} vistasBase={VISTA_UNICA} sinVistas
          searchText={(r: any) => `${r.quien} ${r.empresa || ''} ${r.tipo} ${r.host}`}
          searchPlaceholder="Buscar por nombre, marca o tipo…" minWidth={900}
          mobileCard={(r: any) => (
            <Tarjeta alto={r.quien} bajo={[r.empresa, r.tipo].filter(Boolean).join(' · ')}
              derecha={<span style={{ color: '#c4c8cf', fontSize: '1.1rem' }}>›</span>}
              pie={<>
                <span style={pill(r.es_hoy ? P.rojoAgua : P.agua, r.es_hoy ? P.rojo : P.violetaTinta)}>{fechaCorta(r.fecha, r.hora)}</span>
                {!r.en_google && <span style={pill(P.ambarAgua, P.ambar)}>⚠️ no suena</span>}
                <span style={{ fontSize: '0.72rem', color: '#9aa0a8' }}>{r.host}</span>
              </>} />
          )}
          onRowClick={(r: any) => irAlContacto(r.contact_id)}
          emptyMsg="Ninguna cita próxima salió de una llamada. Las que agendes desde la cabina aparecen aquí." />
      )}
      {tab === 'seguimientos' && c.seguimientos_vencidos > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', background: verVencidos ? P.rojoAgua : '#fff', border: `1px solid ${verVencidos ? '#f0c4bd' : '#e6e4ec'}`, borderRadius: 10, padding: '9px 12px', marginBottom: 10 }}>
          <span style={{ fontSize: 12.5, color: verVencidos ? P.rojo : '#4B5563', flex: 1, minWidth: 180 }}>
            <b>{c.seguimientos_vencidos}</b> {c.seguimientos_vencidos === 1 ? 'se pasó de fecha' : 'se pasaron de fecha'} y {c.seguimientos_vencidos === 1 ? 'sigue' : 'siguen'} sin hacerse.
          </span>
          <button onClick={() => setVerVencidos(v => !v)}
            style={{ fontFamily: 'inherit', fontSize: 12, fontWeight: 700, cursor: 'pointer', background: '#fff', border: `1.5px solid ${verVencidos ? P.rojo : P.violeta}`, color: verVencidos ? P.rojo : P.violetaTinta, borderRadius: 8, padding: '5px 11px' }}>
            {verVencidos ? 'Ver solo lo de hoy' : 'Ver las vencidas'}
          </button>
        </div>
      )}
      {tab === 'seguimientos' && (
        <TablaEnterprise tabla="tel_seguimientos" data={verVencidos ? d.vencidos : d.seguimientos} cols={colsSeguimientos} vistasBase={VISTA_UNICA} sinVistas
          searchText={(r: any) => `${r.quien || ''} ${r.que} ${r.duenio}`}
          searchPlaceholder="Buscar por nombre o por lo prometido…" minWidth={860}
          mobileCard={(r: any) => (
            <Tarjeta alto={r.quien || 'Sin nombre'} bajo={r.que}
              derecha={<span style={{ color: '#c4c8cf', fontSize: '1.1rem' }}>›</span>}
              pie={<>
                <span style={pill(r.vencida ? P.rojoAgua : P.agua, r.vencida ? P.rojo : P.violetaTinta)}>{cuandoLargo(r.cuando)}</span>
                {r.vencida && <span style={pill(P.rojoAgua, P.rojo)}>vencida</span>}
              </>} />
          )}
          onRowClick={(r: any) => irAlContacto(r.contact_id)}
          emptyMsg={verVencidos ? 'Nada vencido.' : 'Nada que devolver hoy ni en los próximos días. Lo que prometas al colgar aparece aquí.'} />
      )}
      {tab === 'oportunidades' && (
        /* `rowKey` explícito: estas filas son de CONTACTOS y no traen `id`
           —el default `r.id` daba undefined en todas y React pintaba la tabla
           sin keys—. */
        <TablaEnterprise tabla="tel_oportunidades" data={d.oportunidades} cols={colsOportunidades} vistasBase={VISTA_UNICA} sinVistas
          rowKey={(r: any) => r.contact_id}
          searchText={(r: any) => `${r.quien} ${r.empresa || ''} ${r.giro || ''} ${r.nota || ''} ${r.telefono || ''}`}
          searchPlaceholder="Buscar por nombre, marca, giro o lo que dijo…" minWidth={1420}
          mobileCard={(r: any) => (
            <Tarjeta alto={r.quien} bajo={r.empresa}
              derecha={<span style={{ color: '#c4c8cf', fontSize: '1.1rem' }}>›</span>}
              pie={<>
                <span style={pill(P.agua, P.violetaTinta)}>{ETAPA_LABEL[r.etapa] || r.etapa}</span>
                <span style={{ fontSize: '0.72rem', color: '#9aa0a8' }}>habló {fechaCorta(r.hablamos)}</span>
                {r.monto ? <span style={{ fontSize: '0.8rem', fontWeight: 800 }}>{dineroMX(r.monto)}</span> : null}
              </>} />
          )}
          onRowClick={(r: any) => irAlContacto(r.contact_id)}
          emptyMsg="Todavía nadie avanzó de etapa después de una llamada." />
      )}
      {tab === 'descalificados' && (
        <TablaEnterprise tabla="tel_descalificados" data={d.descalificados} cols={colsDescalificados} vistasBase={VISTA_UNICA} sinVistas
          rowKey={(r: any) => r.contact_id}
          searchText={(r: any) => `${r.quien} ${r.empresa || ''} ${r.nota || ''} ${r.motivo || ''}`}
          searchPlaceholder="Buscar por nombre, marca o motivo…" minWidth={1220}
          onRowClick={(r: any) => irAlContacto(r.contact_id)}
          mobileCard={(r: any) => (
            <Tarjeta alto={r.quien} bajo={r.empresa || r.giro}
              derecha={<span style={{ color: '#c4c8cf', fontSize: '1.1rem' }}>›</span>}
              pie={<>
                <span style={pill(P.ambarAgua, P.ambar)}>descartado</span>
                <span style={{ fontSize: '0.72rem', color: '#9aa0a8' }}>habló {fechaCorta(r.hablamos)}</span>
              </>} />
          )}
          emptyMsg="Todavía no has descartado a nadie después de llamarle." />
      )}
      {tab === 'listas' && (
        <TablaEnterprise tabla="tel_listas" data={d.listas} cols={colsListas} vistasBase={VISTA_UNICA} sinVistas
          searchText={(r: any) => `${r.nombre} ${r.estado} ${r.duenio}`}
          searchPlaceholder="Buscar por nombre de lista…" minWidth={980}
          mobileCard={(r: any) => (
            <Tarjeta alto={r.nombre} bajo={`${fechaCorta(r.fecha)} · ${r.total} en lista · ${r.contestadas} contestaron`}
              derecha={
                <button onClick={e => { e.stopPropagation(); onAbrirSesion(r.id); }}
                  style={{ fontFamily: 'inherit', fontSize: 12, fontWeight: 700, cursor: 'pointer', background: '#fff', border: `1.5px solid ${P.violeta}`, color: P.violetaTinta, borderRadius: 8, padding: '7px 12px', whiteSpace: 'nowrap' }}>
                  {r.reanudable ? 'Reanudar' : 'Ver'}
                </button>}
              pie={<>
                <span style={pill(r.viva ? P.verdeAgua : '#f4f4f6', r.viva ? P.verde : '#4B5563')}>{r.estado}</span>
                {r.faltan > 0 && <span style={pill(P.ambarAgua, P.ambar)}>{r.faltan} sin marcar</span>}
              </>} />
          )}
          emptyMsg="Todavía no has armado ninguna lista." />
      )}
    </div>
  );
}
