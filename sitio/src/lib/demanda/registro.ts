// DEMAND ENGINE · el arranque.
//
// Un solo import para que todos los handlers queden registrados. Los puntos de
// entrada (los crons y las APIs) importan ESTE archivo, nunca `handlers` a
// secas: así agregar una fuente nueva es agregar una línea aquí, y no descubrir
// tres semanas después que el cron nunca la cargó porque nadie la importó.
//
// El orden importa: `handlers` primero (define `registrar`), las fuentes
// después. Nada de esto puede importar `registro` de vuelta.
import './handlers';
import './fuentes/crm';
import './fuentes/gsc';
import './normalizar';
import './paginas';
import './tecnico';
import './seo';
import './geo/medir';
import './enlaces';
import './competidores';
import './evaluar';
import './score';
import './oportunidades';
import './autonomia';

export { hayHandler, handlerDe, tiposRegistrados } from './handlers';
