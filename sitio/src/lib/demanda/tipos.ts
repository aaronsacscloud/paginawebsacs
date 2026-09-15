// DEMAND ENGINE · los tipos que cruzan todo el motor.
//
// Viven aparte porque la cola, el ciclo, los handlers y las pantallas hablan
// del mismo vocabulario: si cada archivo lo redefine, el día que se agregue un
// estado nuevo habrá cuatro listas que actualizar y tres que se van a olvidar.

/** Cómo sabemos lo que decimos. La regla que no se negocia: una inferencia
 *  jamás se presenta como dato. */
export type Naturaleza = 'observada' | 'inferida' | 'estimada' | 'generada';

export type Riesgo = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type EstadoAccion =
  | 'pendiente'            // espera a que termine su dependencia
  | 'lista'                // el worker puede tomarla
  | 'necesita_aprobacion'  // el riesgo pide al dueño
  | 'aprobada'             // el dueño dijo que sí (pasa a lista)
  | 'rechazada'
  | 'corriendo'
  | 'terminada'
  | 'fallida'              // va a reintentar
  | 'muerta'               // agotó intentos
  | 'para_operador'        // la toma Claude Code en el repo
  | 'cancelada';

export type Accion = {
  id: string;
  clave_idem: string;
  tipo: string;
  prioridad: number;
  estado: EstadoAccion;
  payload: Record<string, any>;
  agente: string | null;
  intentos: number;
  max_intentos: number;
  programada_at: string;
  iniciada_at: string | null;
  terminada_at: string | null;
  lease_hasta: string | null;
  error: any;
  resultado: any;
  creada_por: string;
  depende_de: string | null;
  ciclo_id: string | null;
  run_id: string | null;
  riesgo: Riesgo;
  nivel_requerido: number;
  costo_usd: number;
  motivo: string | null;
  created_at: string;
  updated_at: string;
};

export type Politica = {
  tipo_accion: string;
  nivel: number;
  riesgo: Riesgo;
  requiere_aprobacion: boolean;
  tope_dia: number | null;
  max_intentos: number;
  inmutable: boolean;
  notas: string | null;
};

export type Config = {
  autonomia_global: number;
  presupuesto_mensual_usd: number;
  gasto_mes_usd: number;
  mes_en_curso: string | null;
  kill_switch: boolean;
  modo: 'normal' | 'simulacion';
  mercados: string[];
  idiomas: string[];
  umbrales: Record<string, number>;
  pesos_version: number;
  dueno_whatsapp: string | null;
  arrancado_at: string | null;
};

/** Lo que devuelve un handler. `siguientes` deja que una acción encole la que
 *  sigue: así el ciclo se va armando solo en vez de vivir en una lista fija. */
export type ResultadoHandler = {
  ok: boolean;
  resumen?: string;
  datos?: Record<string, any>;
  costo_usd?: number;
  siguientes?: EntradaAccion[];
  /** Fallo que NO debe reintentarse (credencial ausente, fuente apagada). */
  definitivo?: boolean;
  /** «Todavía no me toca»: vuelve a la cola en N segundos con el contador de
   *  intentos en cero. Lo usa el cierre de ciclo mientras queda trabajo vivo;
   *  esperar no es fallar y no debe gastar reintentos. */
  reprogramar_en_seg?: number;
};

export type EntradaAccion = {
  tipo: string;
  /** Identidad del TRABAJO, no de la corrida: dos detecciones del mismo hecho
   *  el mismo día son una sola acción. Sin esto, el ciclo duplica. */
  clave_idem: string;
  payload?: Record<string, any>;
  prioridad?: number;
  programada_at?: string | Date;
  depende_de?: string | null;
  ciclo_id?: string | null;
  creada_por?: string;
  agente?: string | null;
  motivo?: string | null;
};

/** El contrato del handler. Recibe la acción y hasta cuándo puede trabajar:
 *  un cron de Vercel muere a los 300 s y una acción que no mira el reloj se
 *  lleva a las demás por delante. */
export type Handler = (
  accion: Accion,
  ctx: { limite: number; cfg: Config; ciclo_id: string | null },
) => Promise<ResultadoHandler>;
