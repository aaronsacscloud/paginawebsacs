/* LLAMADAS INTELIGENTES · su propio espacio, sin depender del inbox.
 *
 * PEDIDO DEL DUEÑO (caso 8, 17-sep-2026): «llamadas inteligentes necesita su
 * propio espacio, no depender del inbox».
 *
 * Por qué importaba. La cabina existía sólo dentro del Inbox y heredaba los
 * filtros que estuvieran puestos ahí. Eso obligaba a un rodeo absurdo para una
 * tarea que no tiene nada que ver con WhatsApp: entrar al inbox, acordarte de
 * qué filtro deja la lista que querías, comprobar el número en la barra lateral
 * y recién entonces abrir la cabina. Y como la lista era «lo que hubiera
 * filtrado», dos personas abriendo la cabina el mismo día llamaban a universos
 * distintos sin saberlo.
 *
 * Aquí la lista se ELIGE, con nombre y número a la vista. La cabina es la misma
 * —marcar, la sala, Fernanda, el cierre con IA— porque duplicarla sería tener
 * dos marcadores que se separan en un mes; lo que cambia es de dónde sale la
 * lista y que ya no hay que pasar por el inbox para llegar.
 *
 * Los números de las cinco listas salen de UNA sola llamada: el endpoint del
 * inbox ya devuelve `counts` y `por_etapa` completos con cualquier filtro. Cinco
 * llamadas (una por tarjeta) serían cinco veces la misma consulta pesada.
 */
import { useIsMobile } from '../../../lib/ui/mobile';
import { useState, useEffect, lazy, Suspense } from 'react';
import { P } from '../../../lib/crm/paleta';
import { LIFECYCLE } from '../../../lib/crm/lifecycle';
import { WRAP } from '../../../lib/crm/layout';
import Cargando from './ui/Cargando';
import Chispas, { Sello, CSS_CHISPAS, CSS_SELLO } from './ui/Chispas';

const Cabina = lazy(() => import('./whatsapp/Cabina'));
const Grabaciones = lazy(() => import('./whatsapp/Grabaciones'));
/* Las cuatro listas de lo que salió de llamar. Perezoso como los otros dos:
   arrastra `TablaEnterprise` entera, y lo primero que tiene que pintarse en
   esta pantalla son las listas a las que se puede llamar. */
const TableroLlamadas = lazy(() => import('./TableroLlamadas'));
const ArmadorLista = lazy(() => import('./ArmadorLista'));

type Lista = {
  id: string;
  titulo: string;
  porque: string;      // por qué vale la pena llamarle a ESTA gente
  qs: string;
  cuenta: (c: any) => number;
};

/* Las cinco listas que se llaman de verdad. No son «filtros disponibles»: son
   los cinco motivos por los que alguien levanta el teléfono aquí. Si mañana hay
   un sexto, se agrega con su porqué — una tarjeta sin motivo es un filtro más. */
const LISTAS: Lista[] = [
  {
    id: 'sin_respuesta',
    titulo: 'No te han contestado',
    porque: 'Les escribiste y ahí quedó. La llamada es lo que revive un hilo que el mensaje ya no revive.',
    qs: 'filtro=sin_respuesta',
    cuenta: c => Number(c?.counts?.sin_respuesta || 0),
  },
  {
    id: 'lead',
    titulo: 'Leads nuevos',
    porque: 'Acaban de levantar la mano. Llamar el mismo día es lo que separa una cita de un lead frío.',
    qs: 'etapa=lead',
    cuenta: c => Number(c?.counts?.por_etapa?.lead || 0),
  },
  {
    id: 'lead_calificado',
    titulo: 'Ya calificados',
    porque: 'Sabes que encajan y que tienen con qué. Aquí la llamada busca fecha, no información.',
    qs: 'etapa=lead_calificado',
    cuenta: c => Number(c?.counts?.por_etapa?.lead_calificado || 0),
  },
  {
    id: 'rezagado',
    titulo: 'Rezagados',
    porque: 'Se quedaron a medio camino y la cadencia automática ya no los mueve. O los llamas, o se pierden.',
    qs: 'etapa=rezagado',
    cuenta: c => Number(c?.counts?.por_etapa?.rezagado || 0),
  },
  {
    id: 'mias',
    titulo: 'Los míos',
    porque: 'Los que están a tu nombre. Es tu jornada, sin repartir lo de nadie más.',
    qs: 'filtro=mias',
    cuenta: c => Number(c?.counts?.mias || 0),
  },
];

/* El armador vive aparte desde el 21-sep-2026. Eran tres desplegables sobre el
   inbox —bandeja, etapa, estado— y pasó a ser la pantalla de filtros que pidió
   el dueño: fuente (CRM o prospección), giro, WhatsApp verificado, sucursales,
   estado, calidad y todo lo que se excluye. Con eso ya no cabía aquí. */

export default function LlamadasInteligentes({ yo }: { yo?: any }) {
  /* ══ LA CABINA TAMBIÉN VIVE EN EL TELÉFONO (18-sep-2026) ═════════════════
     Pedido del dueño: «todas las mejoras de llamadas inteligentes en web,
     hazlas funcionar igual en la versión móvil».

     Esta pantalla montaba la cabina SIN decirle que estaba en un teléfono
     —sólo el inbox lo hacía—, así que en el celular se dibujaba con el diseño
     de escritorio: 22 px de margen, la columna de la lista clavada en 340 px y
     todo en fila. La cabina ya sabe acomodarse sola; nadie le avisaba. */
  const esMovil = useIsMobile();
  const [verGrabaciones, setVerGrabaciones] = useState(false);
  const [armando, setArmando] = useState(false);
  const [aMedida, setAMedida] = useState<{ titulo: string; qs: string } | null>(null);
  const [counts, setCounts] = useState<any>(null);
  const [cargando, setCargando] = useState(true);
  const [elegida, setElegida] = useState<Lista | null>(null);
  const [tel, setTel] = useState<{ ok: boolean; faltantes: string[] } | null>(null);
  const [verSesion, setVerSesion] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    // limit=1 porque de esta llamada sólo se quieren los contadores; la lista
    // completa la trae la cabina cuando ya se eligió a quién llamar.
    fetch('/api/crm/whatsapp/inbox?filtro=todas&limit=1', { cache: 'no-store' })
      .then(r => r.json()).then(j => { if (vivo) { setCounts(j); setCargando(false); } })
      .catch(() => { if (vivo) setCargando(false); });
    /* El MISMO endpoint que lee la cabina (`marcador?lista=1`), no
       `telefonia/setup`: setup contesta `configurada`, no `ok`, así que leerlo
       aquí pintaba «no está configurada (faltan 0 datos)» con la telefonía
       encendida. Dos pantallas preguntando lo mismo a dos sitios distintos
       terminan contradiciéndose. */
    fetch('/api/crm/telefonia/marcador?lista=1', { cache: 'no-store' })
      .then(r => r.json()).then(j => { if (vivo) setTel({ ok: !!j.telefonia, faltantes: j.faltantes || [] }); })
      .catch(() => {});
    /* Ya no se pide `/informe`: lo último que quedaba de él aquí era la línea
       de «a qué hora contestan», que el dueño quitó por saturar. Una petición
       menos en la carga de esta pantalla. */
    return () => { vivo = false; };
  }, []);

  if (elegida || verSesion || aMedida) {
    const n = elegida && counts ? elegida.cuenta(counts) : 0;
    /* ══ 🔴 56 PX DE PADDING EN UNA PANTALLA DE 390 (19-sep-2026) ═══════
          `WRAP` es el margen del escritorio: 56 px a cada lado, pensado para
          separar del menú lateral en un monitor. En el teléfono son 112 de 390
          —el 29% de la pantalla— gastados en aire, y por eso la cabina se
          dibujaba dentro de 278 px con las tarjetas cortadas por la derecha.
          Medido con el navegador a 390: el carril útil pasa de 278 a 366. */
    return (
      <div style={{ ...WRAP, ...(esMovil ? { padding: '10px 12px' } : { paddingTop: 22 }) }}>
        <div style={{ border: `1px solid ${'#ececec'}`, borderRadius: 12, overflow: 'hidden', background: '#fff', minHeight: 'calc(100vh - 150px)', display: 'flex', flexDirection: 'column' }}>
          <Suspense fallback={<Cargando texto="Abriendo la cabina…" alto={260} />}>
            <Cabina qs={aMedida?.qs || elegida?.qs || 'filtro=todas'}
              descripcion={aMedida?.titulo || elegida?.titulo || 'Jornada anterior'}
              /* La lista a medida entra con total 0: el número real lo cuenta la
                 cabina al leer la lista, y adivinarlo aquí sólo serviría para
                 desmentirse dos segundos después. */
              total={aMedida ? 0 : n} yo={yo} movil={esMovil}
              sesionInicial={verSesion}
              onCerrar={() => { setElegida(null); setVerSesion(null); setAMedida(null); }}
              onAbrirConversacion={id => { window.location.href = `/admin/crm?tab=whatsapp&wa_conv=${id}`; }} />
          </Suspense>
        </div>
      </div>
    );
  }

  return (
    <div style={{ ...WRAP, ...(esMovil ? { padding: '10px 12px' } : { paddingTop: 22 }) }}>
      <style>{CSS_CHISPAS + CSS_SELLO}</style>
      {/* ── EL ENCABEZADO: TÍTULO A LA IZQUIERDA, ACCIONES A LA DERECHA ──────
          Decisión del dueño (21-sep-2026), dos cosas de la misma línea:

          · «esto ponlo bien arriba a la derecha» (los botones). Estaban debajo
            del párrafo, a la altura de su última línea: en una pantalla ancha
            el ojo tenía que bajar para encontrar la acción principal. Arriba,
            en el renglón del título, es donde se buscan.
          · «quita eso, lo satura» — la línea de «a esta gente le contestan más
            de 13 a 15 h». Era un dato medido de sus propias llamadas, pero en
            morado y negritas debajo del párrafo competía con el título y con
            los botones. El cálculo sigue vivo en `/api/crm/telefonia/informe`,
            que es de donde come Reportes; sólo deja de gritar aquí. */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap', marginBottom: 18 }}>
        <div style={{ flex: '1 1 380px', minWidth: 0 }}>
          <div className="chispas-cab" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
            <Chispas />
            <h1 style={{ fontSize: 21, fontWeight: 800, letterSpacing: '-0.02em', margin: 0, color: '#16181d' }}>Llamadas inteligentes <Sello>La voz que las enciende</Sello></h1>
          </div>
          <p style={{ fontSize: 13, color: '#6b7280', margin: 0, maxWidth: 620, lineHeight: 1.55 }}>
            Elige a quién le llamas hoy. La cabina marca uno tras otro, te pasa la
            llamada cuando contestan y al colgar deja la nota, la etapa y la cita.
          </p>
        </div>
        {/* EL BOTÓN, NO UNA TARJETA MÁS: uno por pantalla, en morado sólido, y
            arriba del todo. */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0, flexWrap: 'wrap', marginLeft: 'auto' }}>
          <button onClick={() => setVerGrabaciones(true)}
            style={{ border: `1.5px solid ${P.violeta}`, borderRadius: 11, padding: '10px 16px', fontSize: 13.5, fontWeight: 700,
              fontFamily: 'inherit', cursor: 'pointer', background: '#fff', color: P.violetaTinta }}>
            Grabaciones
          </button>
          <button onClick={() => setArmando(true)}
            style={{ border: 'none', borderRadius: 11, padding: '11px 20px', fontSize: 14, fontWeight: 800,
              fontFamily: 'inherit', cursor: 'pointer', background: P.violetaTinta, color: '#fff' }}>
            Nueva llamada inteligente
          </button>
        </div>
      </div>

      {verGrabaciones && (
        <div role="dialog" aria-label="Grabaciones" style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(12,11,18,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: esMovil ? 0 : 20 }}
          onClick={e => { if (e.target === e.currentTarget) setVerGrabaciones(false); }}>
          <div style={{ background: '#F7F7F9', borderRadius: esMovil ? 0 : 16, width: esMovil ? '100%' : 'min(820px, 100%)', height: esMovil ? '100%' : 'min(88vh, 900px)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#fff', borderBottom: '1px solid #ececec' }}>
              <b style={{ fontSize: 14 }}>Grabaciones</b>
              <button onClick={() => setVerGrabaciones(false)} style={{ border: 'none', background: 'none', fontSize: 20, cursor: 'pointer', color: '#6B7280', lineHeight: 1 }} aria-label="Cerrar">×</button>
            </div>
            <Suspense fallback={<Cargando texto="Abriendo las grabaciones…" alto={200} />}>
              <Grabaciones movil={esMovil} />
            </Suspense>
          </div>
        </div>
      )}

      {tel && !tel.ok && (
        <div style={{ background: '#FFF4E5', border: '1px solid #f3d9a4', color: '#9a6a10', borderRadius: 9, padding: '9px 13px', fontSize: 12.5, marginBottom: 14 }}>
          La telefonía no está configurada (faltan {tel.faltantes.length} datos). Puedes armar la lista y revisarla, pero no marcar.
        </div>
      )}

      {armando && (
        <Suspense fallback={null}>
          <ArmadorLista etapas={LIFECYCLE}
            onListo={l => { setArmando(false); setAMedida(l); }} onCerrar={() => setArmando(false)} />
        </Suspense>
      )}

      {cargando ? <Cargando texto="Contando a quién se le puede llamar…" alto={220} /> : (
        /* Flex y no `grid` con `auto-fill`: con cinco tarjetas y cuatro
           columnas, la quinta se quedaba sola dejando media fila de fondo
           colgando — el descuadre número uno de la regla de la casa. En flex,
           las del último renglón crecen y lo llenan, sean cinco o siete. */
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          {LISTAS.map(l => {
            const n = counts ? l.cuenta(counts) : 0;
            const vacia = n === 0;
            return (
              /* La tarjeta entera es el botón: en una pantalla cuyo único verbo
                 es «llamar a estos», un botoncito abajo a la derecha obliga a
                 apuntar a un blanco de 90 px teniendo 268 disponibles. */
              <button key={l.id} onClick={() => !vacia && setElegida(l)} disabled={vacia}
                style={{
                  textAlign: 'left', fontFamily: 'inherit', cursor: vacia ? 'default' : 'pointer',
                  background: '#fff', border: '1px solid #ececec', borderLeft: `3px solid ${vacia ? '#e0dfe6' : P.violeta}`,
                  borderRadius: 10, padding: '15px 17px', opacity: vacia ? 0.6 : 1,
                  display: 'flex', flexDirection: 'column', flex: '1 1 200px',
                }}>
                <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: '#999' }}>{l.titulo}</span>
                <span style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.03em', color: vacia ? '#a5a2af' : P.violetaTinta, margin: '2px 0 4px', fontVariantNumeric: 'tabular-nums' }}>{n}</span>
                {/* marginTop:auto — así dos tarjetas del mismo renglón cierran a
                    la misma altura aunque un porqué ocupe una línea más. */}
                <span style={{ fontSize: 11.5, color: '#888', lineHeight: 1.5, marginTop: 'auto' }}>
                  {vacia ? 'Nadie en esta lista ahora mismo.' : l.porque}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* ══ LO QUE SALIÓ DE LLAMAR ══════════════════════════════════════════
          Aquí vivían tres bloques sueltos —seis cifras de treinta días, los
          compromisos y las jornadas anteriores— y los tres se retiraron el
          21-sep-2026 por decisión del dueño: «quita los cards que aparecen de
          KPIs y sólo vamos a agregar un data table que muestre en tabs…».

          No es mover cosas de sitio. Las cifras («24 conversaciones · 96
          minutos · 8 citas») informaban cómo vas, pero con ninguna se podía
          hacer nada: no dicen a quién le toca. Los compromisos y las jornadas
          sí eran accionables, pero eran listas planas sin buscar, ordenar ni
          filtrar, y con dieciséis jornadas ya no se encontraba la de ayer.

          Ahora son cuatro pestañas de una tabla de verdad, y cada una contesta
          una pregunta con nombre y apellido. El histórico de treinta días que
          se pierde aquí vive en Reportes, que es su sitio. */}
      <Suspense fallback={<Cargando texto="Cargando lo que salió de tus llamadas…" alto={180} />}>
        <TableroLlamadas onAbrirSesion={id => setVerSesion(id)} />
      </Suspense>

      <p style={{ fontSize: 11.5, color: '#a5a2af', marginTop: 14, maxWidth: 620, lineHeight: 1.55 }}>
        De cualquier lista se quitan solos los que no tienen teléfono, los marcados
        «no llamar» y los que ya se intentaron tres veces esta semana. Vas a poder
        revisar la lista completa antes de que suene el primer timbre.
      </p>
    </div>
  );
}
