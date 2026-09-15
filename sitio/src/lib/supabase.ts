import { createClient } from '@supabase/supabase-js';

// `import.meta.env` es lo que Astro inyecta en el build; `process.env` es lo
// que hay cuando este mismo código se corre desde un script de node (que es
// como se prueba el motor de demanda sin levantar el sitio, y cómo lo usan ya
// los scripts de Trabajo Inteligente). Antes solo existía la primera vía, así
// que importar cualquier librería del repo desde un script daba un cliente
// apuntando a la cadena vacía y fallaba con un error que no decía por qué.
const url = (import.meta as any).env?.SUPABASE_URL || process.env.SUPABASE_URL || '';
const key = (import.meta as any).env?.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_KEY || '';

export const supabase = createClient(url, key);
