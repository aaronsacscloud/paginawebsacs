// Generar y GUARDAR un reporte de una cuenta (entregas, trabajo en curso o
// ejecutivo). Vivía dentro de /api/crm/reportes; salió aquí para que el correo
// ejecutivo de la ficha genere los mismos reportes con las mismas reglas, en
// vez de una copia que se desincroniza.
//
// Guarda una FOTO de los hechos: la liga que el cliente recibe tiene que decir
// en diciembre lo mismo que decía en septiembre.
import { supabase } from '../supabase';
import { reunirHechos, reunirEntregas, reunirEnCurso } from './reporte-hechos';

export type TipoReporteCuenta = 'entregas' | 'curso' | 'trabajo';

export async function generarReporteCuenta(o: {
  tipo: TipoReporteCuenta; companyId: string; desde: string; hasta: string;
  modulos?: string[] | null; narrativa?: any; creadoPor?: string | null;
}): Promise<{ id: string; tipo: string; folio: string; hechos: any } | { error: string; status: number }> {
  const { tipo, companyId, desde, hasta } = o;
  if (!desde || !hasta) return { error: 'Falta el periodo.', status: 400 };
  if (desde > hasta) return { error: 'El periodo está al revés.', status: 400 };

  const hechos: any = tipo === 'entregas' ? await reunirEntregas(companyId, desde, hasta, o.modulos || null)
    : tipo === 'curso' ? await reunirEnCurso(companyId, desde, hasta)
    : await reunirHechos(companyId, desde, hasta);
  if (!hechos) return { error: 'Ese cliente ya no existe.', status: 404 };

  /* Un reporte de entregas VACÍO no se publica: «se te entregaron 0 cosas» es
     peor que no mandarlo. Uno EN CURSO vacío tampoco: «no te estamos
     construyendo nada» se conversa, no se manda. El de trabajo sí puede ir sin
     entregas: trae soporte, uso y oportunidades. */
  if (tipo === 'entregas' && !hechos.total) {
    return { error: 'En ese periodo no hay ninguna entrega visible para el cliente. Cambia las fechas o revisa que estén marcadas como «se le puede mostrar al cliente».', status: 400 };
  }
  if (tipo === 'curso' && !hechos.total) {
    return { error: 'Esta cuenta no tiene nada vivo en el taller. Un reporte de trabajo en curso sin trabajos no se manda.', status: 400 };
  }

  const { data, error } = await supabase.from('reportes_trabajo').insert({
    company_id: companyId, desde, hasta, tipo, hechos,
    narrativa: o.narrativa || null, creado_por: o.creadoPor || null,
  }).select('id, tipo, folio').single();
  if (error) return { error: error.message, status: 500 };
  return { id: data.id, tipo: data.tipo, folio: data.folio, hechos };
}
