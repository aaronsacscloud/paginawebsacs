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
import { useState, useEffect, lazy, Suspense } from 'react';
import { P } from '../../../lib/crm/paleta';
import { WRAP } from '../../../lib/crm/layout';
import Cargando from './ui/Cargando';
import Chispas, { CSS_CHISPAS } from './ui/Chispas';

const Cabina = lazy(() => import('./whatsapp/Cabina'));

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

export default function LlamadasInteligentes({ yo }: { yo?: any }) {
  const [counts, setCounts] = useState<any>(null);
  const [cargando, setCargando] = useState(true);
  const [elegida, setElegida] = useState<Lista | null>(null);
  const [tel, setTel] = useState<{ ok: boolean; faltantes: string[] } | null>(null);
  const [previas, setPrevias] = useState<any[]>([]);
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
      .then(r => r.json()).then(j => { if (vivo) { setTel({ ok: !!j.telefonia, faltantes: j.faltantes || [] }); setPrevias(j.sesiones || []); } })
      .catch(() => {});
    return () => { vivo = false; };
  }, []);

  if (elegida || verSesion) {
    const n = elegida && counts ? elegida.cuenta(counts) : 0;
    return (
      <div style={{ ...WRAP, paddingTop: 22 }}>
        <div style={{ border: `1px solid ${'#ececec'}`, borderRadius: 12, overflow: 'hidden', background: '#fff', minHeight: 'calc(100vh - 150px)', display: 'flex', flexDirection: 'column' }}>
          <Suspense fallback={<Cargando texto="Abriendo la cabina…" alto={260} />}>
            <Cabina qs={elegida?.qs || 'filtro=todas'} descripcion={elegida?.titulo || 'Jornada anterior'} total={n} yo={yo}
              sesionInicial={verSesion}
              onCerrar={() => { setElegida(null); setVerSesion(null); }}
              onAbrirConversacion={id => { window.location.href = `/admin/crm?tab=whatsapp&wa_conv=${id}`; }} />
          </Suspense>
        </div>
      </div>
    );
  }

  return (
    <div style={{ ...WRAP, paddingTop: 22 }}>
      <style>{CSS_CHISPAS}</style>
      <div className="chispas-cab" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
        <Chispas />
        <h1 style={{ fontSize: 21, fontWeight: 800, letterSpacing: '-0.02em', margin: 0, color: '#16181d' }}>Llamadas inteligentes</h1>
      </div>
      <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 18px', maxWidth: 620, lineHeight: 1.55 }}>
        Elige a quién le llamas hoy. La cabina marca uno tras otro, te pasa la
        llamada cuando contestan y al colgar deja la nota, la etapa y la cita.
      </p>

      {tel && !tel.ok && (
        <div style={{ background: '#FFF4E5', border: '1px solid #f3d9a4', color: '#9a6a10', borderRadius: 9, padding: '9px 13px', fontSize: 12.5, marginBottom: 14 }}>
          La telefonía no está configurada (faltan {tel.faltantes.length} datos). Puedes armar la lista y revisarla, pero no marcar.
        </div>
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

      {previas.length > 0 && (
        /* Las jornadas anteriores viven AQUÍ y no sólo dentro de la cabina.
           Es lo primero que se pregunta al llegar —«¿cómo me fue ayer y qué
           quedó sin marcar?»— y tenerlo detrás de elegir una lista obligaba a
           fingir que ibas a empezar otra para poder mirar la de ayer. */
        <div style={{ marginTop: 22 }}>
          <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: '#999' }}>Tus jornadas anteriores</span>
          <div style={{ display: 'grid', gap: 6, marginTop: 7 }}>
            {previas.slice(0, 6).map(p => {
              const viva = ['activa', 'pausada'].includes(p.estado);
              return (
                <div key={p.id} style={{ background: '#fff', border: '1px solid #ececec', borderRadius: 10, padding: '9px 13px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 180 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#16181d' }}>{p.nombre || 'Jornada'}</div>
                    <div style={{ fontSize: 11.5, color: '#6b7280' }}>
                      {String(p.created_at).slice(0, 10)} · {p.total} en lista · {p.contestadas} contestaron · {p.buzon} buzón · {p.sin_contestar} sin contestar
                    </div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, borderRadius: 999, padding: '2px 8px', background: viva ? '#EAF8F2' : '#f4f4f6', color: viva ? '#1E8A63' : '#4B5563' }}>{p.estado}</span>
                  <button onClick={() => setVerSesion(p.id)}
                    style={{ fontFamily: 'inherit', fontSize: 12, fontWeight: 700, cursor: 'pointer', background: '#fff', border: `1.5px solid ${P.violeta}`, color: P.violetaTinta, borderRadius: 8, padding: '5px 11px' }}>
                    {viva ? 'Seguir' : 'Ver'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <p style={{ fontSize: 11.5, color: '#a5a2af', marginTop: 14, maxWidth: 620, lineHeight: 1.55 }}>
        De cualquier lista se quitan solos los que no tienen teléfono, los marcados
        «no llamar» y los que ya se intentaron tres veces esta semana. Vas a poder
        revisar la lista completa antes de que suene el primer timbre.
      </p>
    </div>
  );
}
