// Publicar en un canal de CHARLA desde el sistema.
//
// `espacio-sistema.ts` ya escribe, pero solo en los cuatro canales de tipo
// `sistema` —son un río silenciado, la bitácora de la campana—. Esto es otra
// cosa: un aviso que se publica DONDE LA GENTE PLATICA, para que se pueda
// contestar en el hilo y quede la conversación pegada al aviso.
//
// Se usa poco a propósito. Un canal de charla al que el sistema le escribe
// seguido deja de ser una charla: se vuelve otro río que nadie lee, y entonces
// el aviso que sí importaba se pierde entre los que no. Hoy solo lo usa el
// cierre de comisiones de los lunes.
import { supabase } from '../supabase';
import { AGENTE_IA_ID, emitir, type Cita } from './espacio.lib';

export type Publicacion = {
  /** Nombre del canal, sin `#`. */
  canal: string;
  texto: string;
  /** Idempotencia: con la misma clave no se publica dos veces. Un cron que se
   *  reintenta —Vercel lo hace— no debe dejar el mismo aviso dos veces. */
  clave?: string | null;
  citas?: Cita[];
  metadata?: Record<string, any>;
};

/** Publica y devuelve el id. Nunca lanza: el aviso es cortesía, no el hecho. */
export async function publicarEnCanal(o: Publicacion): Promise<{ id: string | null; motivo?: string }> {
  try {
    const { data: canal } = await supabase.from('espacio_canales')
      .select('id, archivado_at').eq('nombre', o.canal).is('archivado_at', null).maybeSingle();
    // Si alguien renombró o archivó el canal, se dice: un aviso que no salió y
    // nadie sabe que no salió es peor que no tener el aviso.
    if (!canal?.id) return { id: null, motivo: `no existe el canal #${o.canal} (¿lo renombraron o archivaron?)` };

    if (o.clave) {
      const { data: ya } = await supabase.from('espacio_mensajes')
        .select('id').eq('metadata->>clave', o.clave).limit(1);
      if (ya?.length) return { id: ya[0].id, motivo: 'ya estaba publicado' };
    }

    const { data, error } = await supabase.from('espacio_mensajes').insert({
      canal_id: canal.id, autor_id: AGENTE_IA_ID,
      texto: String(o.texto || '').slice(0, 4000),
      menciones: [], adjuntos: [], citas: (o.citas || []).slice(0, 4),
      metadata: { ...(o.metadata || {}), ...(o.clave ? { clave: o.clave } : {}) },
    }).select('id').single();
    if (error) return { id: null, motivo: error.message };

    await emitir({ tipo: 'msg', canal_id: canal.id, id: data.id, autor_id: AGENTE_IA_ID });
    return { id: data.id };
  } catch (e: any) {
    return { id: null, motivo: e?.message || String(e) };
  }
}
