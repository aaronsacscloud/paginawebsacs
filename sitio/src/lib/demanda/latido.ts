// DEMAND ENGINE · el latido.
//
// Un sistema autónomo no muere gritando: **se queda callado**. Deja de tomar
// trabajo, o lo toma y no lo acaba, o lo acaba pero sin hacer nada — y todas
// esas formas de estar muerto se ven exactamente igual desde fuera que estar
// tranquilo. Esa es la razón de este archivo: el silencio no puede ser un
// estado válido.
//
// Este proyecto ya tiene el precedente: el 3-sep el agente de Trabajo
// Inteligente estuvo 16 minutos sin correr y no se cayó — le tocaba correr y
// los despliegues de Vercel se comieron las invocaciones. Sin un latido que
// distinga «está tranquilo» de «lleva horas sin latir», eso se descubre cuando
// alguien va a mirar por casualidad.
//
// El latido NO dice «todo bien / todo mal». Dice **qué señal falta y desde
// cuándo**, que es lo único con lo que se puede hacer algo.
import { supabase } from '../supabase';
import { leerConfig } from './config';
import { notificar } from '../crm/notificaciones';
import { registrar } from './handlers';
import { traerTodo } from './paginar';
import type { ResultadoHandler } from './tipos';

export type Signo = {
  que: string;
  /** null = no se pudo medir, que NO es lo mismo que estar bien. */
  minutos: number | null;
  tope: number;
  bien: boolean;
  detalle: string;
};

export type Latido = {
  vivo: boolean;
  signos: Signo[];
  /** Solo lo que está mal. Un latido sano no debería obligar a leer nada. */
  problemas: string[];
  ahora: string;
};

const minDesde = (iso?: string | null): number | null =>
  iso ? Math.round((Date.now() - new Date(iso).getTime()) / 60000) : null;

const humano = (m: number | null) =>
  m === null ? 'nunca' : m < 60 ? `hace ${m} min` : m < 1440 ? `hace ${Math.round(m / 60)} h` : `hace ${Math.round(m / 1440)} d`;

/**
 * Los signos vitales del motor.
 *
 * Los topes son generosos a propósito. Un latido que avisa por cualquier cosa
 * se silencia a la semana, y entonces no avisa por nada — que es peor que no
 * tenerlo, porque además da la sensación de estar vigilado.
 */
export async function tomar(): Promise<Latido> {
  const cfg = await leerConfig(true);
  const ahora = new Date().toISOString();

  const [ultimaAccion, ultimoCiclo, ultimaSalud, listas, corriendo] = await Promise.all([
    supabase.from('de_acciones').select('terminada_at').not('terminada_at', 'is', null)
      .order('terminada_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('de_ciclos').select('inicio, estado').order('inicio', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('de_salud').select('created_at, score').order('created_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('de_acciones').select('id', { count: 'exact', head: true }).eq('estado', 'lista').lte('programada_at', ahora),
    supabase.from('de_acciones').select('id, tipo, lease_hasta', { count: 'exact' }).eq('estado', 'corriendo'),
  ]);

  const mTrabajo = minDesde(ultimaAccion.data?.terminada_at);
  const mCiclo = minDesde(ultimoCiclo.data?.inicio);
  const mSalud = minDesde(ultimaSalud.data?.created_at);
  const pendientes = listas.count ?? 0;

  const signos: Signo[] = [
    {
      // El worker corre cada 5 minutos. Si hay trabajo esperando y hace media
      // hora que no termina nada, no está tranquilo: está atorado.
      que: 'El worker termina trabajo',
      minutos: mTrabajo, tope: 30,
      bien: pendientes === 0 || (mTrabajo !== null && mTrabajo <= 30),
      detalle: pendientes === 0
        ? `sin trabajo pendiente (lo último, ${humano(mTrabajo)})`
        : `${pendientes} acción(es) esperando y lo último terminó ${humano(mTrabajo)}`,
    },
    {
      // El ciclo diario abre a las 6. Se dan 26 horas: un despliegue justo a esa
      // hora se come la invocación, y esperar al siguiente día es lo correcto
      // antes de despertar a nadie.
      que: 'El ciclo diario abre',
      minutos: mCiclo, tope: 26 * 60,
      bien: mCiclo !== null && mCiclo <= 26 * 60,
      detalle: `el último ciclo empezó ${humano(mCiclo)}${ultimoCiclo.data?.estado ? ` (${ultimoCiclo.data.estado})` : ''}`,
    },
    {
      que: 'El motor se revisa a sí mismo',
      minutos: mSalud, tope: 26 * 60,
      bien: mSalud !== null && mSalud <= 26 * 60,
      detalle: `última revisión ${humano(mSalud)}${ultimaSalud.data ? `, salud ${ultimaSalud.data.score}/100` : ''}`,
    },
  ];

  /* Leases vencidos: el síntoma de un worker que se muere a media acción. El
     vigilante los recupera solo, así que verlos no es una emergencia — pero
     verlos SIEMPRE sí lo es, porque significa que algo se muere cada vuelta. */
  const vencidos = (corriendo.data || []).filter((a: any) => a.lease_hasta && new Date(a.lease_hasta) < new Date());
  signos.push({
    que: 'Nada se queda colgado',
    minutos: null, tope: 0,
    bien: vencidos.length === 0,
    detalle: vencidos.length
      ? `${vencidos.length} acción(es) con el plazo vencido: ${[...new Set(vencidos.map((a: any) => a.tipo))].join(', ')}`
      : `${corriendo.count ?? 0} corriendo, ninguna colgada`,
  });

  // El apagador no es un fallo: es una decisión. Pero un motor apagado que
  // nadie recuerda haber apagado es un motor muerto con otro nombre.
  if (cfg.kill_switch) {
    signos.push({
      que: 'El motor está encendido', minutos: null, tope: 0, bien: false,
      detalle: 'APAGADO a mano (kill switch). No escribe nada hasta que se encienda.',
    });
  }

  const problemas = signos.filter(s => !s.bien).map(s => `${s.que}: ${s.detalle}`);
  return { vivo: problemas.length === 0, signos, problemas, ahora };
}

/**
 * Autodiagnóstico: además de mirar los signos, intenta decir POR QUÉ.
 *
 * Un latido que dice «el worker no termina nada» manda a alguien a leer
 * bitácoras. Uno que dice «no termina nada y hay 4 acciones muertas del mismo
 * tipo» ya hizo la mitad del trabajo.
 */
export async function diagnosticar(l: Latido): Promise<string[]> {
  if (l.vivo) return [];
  const pistas: string[] = [];

  const muertas = await traerTodo<any>('de_acciones', 'tipo, error, terminada_at',
    q => q.eq('estado', 'muerta').gte('terminada_at', new Date(Date.now() - 864e5).toISOString()));

  const porTipo = new Map<string, number>();
  for (const m of muertas) porTipo.set(m.tipo, (porTipo.get(m.tipo) || 0) + 1);

  for (const [tipo, n] of [...porTipo.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3)) {
    const ej = muertas.find(m => m.tipo === tipo)?.error?.mensaje || '';
    pistas.push(`«${tipo}» se rindió ${n} ${n === 1 ? 'vez' : 'veces'} en 24 h${ej ? `: ${String(ej).slice(0, 120)}` : ''}`);
  }

  // Las dos causas que este proyecto ya ha visto, dichas con nombre.
  const cfg = await leerConfig();
  const { presupuesto } = await import('./config');
  const pres = await presupuesto(cfg);
  if (pres.agotado)
    pistas.push(`El presupuesto del mes está agotado ($${pres.gastado.toFixed(2)} de $${pres.tope}): lo que cuesta modelo se está difiriendo, y por eso parece parado.`);

  const { data: sinLlave } = await supabase.from('de_conectores')
    .select('nombre, falta').eq('disponible', false).limit(4);
  if (sinLlave?.length)
    pistas.push(`Fuentes sin acceso: ${sinLlave.map((k: any) => `${k.nombre} (${k.falta || 'falta credencial'})`).join(', ')}.`);

  return pistas;
}

// ── el handler ──────────────────────────────────────────────────────────────
registrar('sistema.latido', async (): Promise<ResultadoHandler> => {
  const l = await tomar();
  const pistas = l.vivo ? [] : await diagnosticar(l);

  if (!l.vivo) {
    /* La clave lleva la FECHA y no la hora: si el motor lleva tres días
       callado, avisar cada cinco minutos convierte el aviso en ruido y el
       dueño deja de mirar la campana. Una vez al día, con lo que se sabe. */
    await notificar({
      clave: `de_latido:${new Date().toISOString().slice(0, 10)}`,
      tipo: 'demanda_latido', nivel: 'alerta',
      titulo: 'El motor de demanda no está latiendo bien',
      detalle: [...l.problemas, ...pistas].join(' · ').slice(0, 900),
      destino: 'de-sistema',
    });
  }

  return {
    ok: true,
    resumen: l.vivo
      ? `latiendo · ${l.signos.length} signos bien`
      : `${l.problemas.length} problema(s): ${l.problemas[0]}`,
    datos: { ...l, pistas },
  };
});
