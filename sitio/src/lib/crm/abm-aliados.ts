// ══ LOS ALIADOS COMERCIALES DE SACS ═════════════════════════════════════════
//
// Un aliado no es un prospecto. Al prospecto le vendemos su licencia; el aliado
// nos pone enfrente de muchos retailers que nunca nos habrían contestado en
// frío —o directamente opera Sacs por su cuenta—. Por eso vive aparte: otro
// motivo para hablarle, otro trato y otra forma de medirlo.
//
// Esta lista es la fuente única. La usan el motor ABM (a quién buscamos y qué
// le decimos), la pantalla del CRM y la página pública de partners. Antes
// estaba repartida entre dos giros sueltos del ABM —`aliados` y `canal`— y la
// página de /partners prometía cuatro perfiles de los que solo uno y medio
// existían en la base: cero proveedores de tecnología, cero contadores.
//
// Dos ejes, porque son dos preguntas distintas:
//   · PERFIL  — qué es la alianza y cómo se paga. Lo que promete /partners.
//   · TIPO    — quién es, dónde se busca y con qué se le entra.
// Un mismo tipo puede entrar por dos perfiles: una consultora de retail puede
// ser orquestadora (opera Sacs) o referidora (solo nos presenta). El perfil se
// decide hablando con ella, no se adivina en la carga.

/** Qué es la alianza y cómo se paga. Son los cuatro de la página pública. */
export type Perfil = 'orquestador' | 'consultor' | 'referidor' | 'tecnologia';

export const PERFILES: Record<Perfil, { nombre: string; gana: string; quees: string }> = {
  orquestador: {
    nombre: 'Partner orquestador',
    gana: 'Ingreso recurrente por cada retailer que opera, de por vida',
    quees: 'Monta un negocio propio sobre Sacs: vende, implementa y opera. Nosotros lo certificamos y lo acompañamos en sus primeras tiendas.',
  },
  consultor: {
    nombre: 'Consultor o especialista',
    gana: 'Comisión por la licencia, más sus propios servicios',
    quees: 'Ya cobra por asesorar al retailer. Suma Sacs a su servicio para que su estrategia además se ejecute.',
  },
  referidor: {
    nombre: 'Referidor',
    gana: '40 % de por vida de cada negocio referido',
    quees: 'Nos presenta a la tienda o la marca. Nosotros hacemos la venta y cerramos; él cobra mientras esa cuenta sea cliente.',
  },
  tecnologia: {
    nombre: 'Proveedor de tecnología',
    gana: 'Distribución en la base de clientes de Sacs',
    quees: 'Conecta su producto por API y MCP y llega a todas las marcas que operan con Sacs.',
  },
};

/** De dónde sale cada lista. No todos se buscan igual, y ahí estaba el hueco:
 *  a un creador de contenido no lo encuentras en Google Maps. */
export type Fuente = 'maps' | 'instagram' | 'tiktok' | 'linkedin' | 'directorio' | 'cliente';

export const FUENTES: Record<Fuente, string> = {
  maps: 'Google Maps (el barrido del manual, §2)',
  instagram: 'Instagram — búsqueda por hashtag y por cuentas que sigue nuestra base',
  tiktok: 'TikTok — búsqueda por tema y por creadores del nicho',
  linkedin: 'LinkedIn — firmas y consultores por puesto',
  directorio: 'Directorio del sector (cámara, feria, plataforma, padrón)',
  cliente: 'Nuestros propios clientes: a quién le compran y quién les asesora',
};

export type TipoAliado = {
  /** Familia: para qué sirve el aliado. Ordena la pantalla y la lista. */
  familia: 'asesora' | 'trabaja_con' | 'reune' | 'audiencia' | 'conecta';
  nombre: string;
  /** El perfil que le queda de salida; se confirma hablando con él. */
  perfil: Perfil;
  /** Dónde se busca esta lista, en orden. */
  fuentes: Fuente[];
  /** Por qué le importa a ÉL, no a nosotros. Es la entrada del primer correo. */
  gancho: string;
  /** Subgiros que ya existen en `abm_cuentas` y caen aquí (para no duplicar). */
  ya?: string[];
};

export const FAMILIAS: Record<TipoAliado['familia'], string> = {
  asesora: 'Asesoran al retailer',
  trabaja_con: 'Ya trabajan con nuestros clientes',
  reune: 'Reúnen a muchos retailers',
  audiencia: 'Tienen la audiencia',
  conecta: 'Conectan por tecnología',
};

/* La lista. La clave es la que se guarda en `abm_cuentas.subgiro`, así que se
   escribe una vez y no se cambia: cambiarla deja huérfanas las cuentas ya
   cargadas. El nombre visible sí se puede editar. */
export const ALIADOS: Record<string, TipoAliado> = {
  // ── Asesoran al retailer ──────────────────────────────────────────────────
  consultora_moda: {
    familia: 'asesora', perfil: 'orquestador', ya: ['Firma'],
    nombre: 'Consultora de fashion retail',
    fuentes: ['linkedin', 'instagram', 'maps'],
    gancho: 'Entrega diagnósticos de inventario y surtido que el cliente después no ejecuta. Sacs es donde su plan se vuelve operación.',
  },
  consultora_retail: {
    familia: 'asesora', perfil: 'orquestador',
    nombre: 'Consultora de retail (no solo moda)',
    fuentes: ['linkedin', 'directorio'],
    gancho: 'Ya vende proyectos de retail en general; moda es el vertical donde el surtido por talla y color le pide un sistema aparte.',
  },
  consultor_inventario: {
    familia: 'asesora', perfil: 'consultor', ya: ['Consultora independiente'],
    nombre: 'Consultor independiente de inventario y compras',
    fuentes: ['linkedin', 'instagram'],
    gancho: 'Cobra por hora y su trabajo muere cuando se va. Con Sacs deja instalado lo que recomendó y cobra recurrente.',
  },
  visual_merchandiser: {
    familia: 'asesora', perfil: 'consultor',
    nombre: 'Visual merchandiser y diseño de tienda',
    fuentes: ['instagram', 'linkedin'],
    gancho: 'Acomoda el piso sin saber qué rota. Los datos de Sacs le dicen qué exhibir y dónde.',
  },
  escuela_moda: {
    familia: 'asesora', perfil: 'referidor', ya: ['Escuela'],
    nombre: 'Escuela y universidad de moda',
    fuentes: ['maps', 'instagram', 'directorio'],
    gancho: 'Sus alumnas salen a abrir marca sin saber costear ni surtir. Sacs como herramienta del programa, y beneficio para las egresadas.',
  },
  comunidad: {
    familia: 'asesora', perfil: 'referidor', ya: ['Comunidad'],
    nombre: 'Comunidad de emprendedoras de moda',
    fuentes: ['instagram', 'tiktok'],
    gancho: 'Su comunidad pregunta siempre lo mismo: cómo llevar el inventario. Un beneficio para sus miembros responde por ella.',
  },

  // ── Ya trabajan con nuestros clientes ─────────────────────────────────────
  taller: {
    familia: 'trabaja_con', perfil: 'referidor',
    nombre: 'Taller de confección y maquila',
    fuentes: ['maps', 'cliente', 'directorio'],
    gancho: 'Le piden reposiciones por WhatsApp y sin curva. Si su cliente lleva Sacs, el pedido le llega por talla y color.',
  },
  patronista: {
    familia: 'trabaja_con', perfil: 'referidor',
    nombre: 'Patronista y diseñador de modas',
    fuentes: ['instagram', 'cliente'],
    gancho: 'Diseña a ciegas: no sabe qué modelo suyo se vendió ni en qué talla se quedó.',
  },
  contador: {
    familia: 'trabaja_con', perfil: 'referidor',
    nombre: 'Contador y despacho contable',
    fuentes: ['maps', 'linkedin', 'cliente'],
    gancho: 'Cierra el mes persiguiendo tickets y un inventario que nadie cuadra. Con Sacs recibe los números ya cuadrados.',
  },
  insumos_tienda: {
    familia: 'trabaja_con', perfil: 'referidor', ya: ['Proveedores de boutiques'],
    nombre: 'Proveedor de insumos de tienda (etiquetas, ganchos, empaque, mobiliario)',
    fuentes: ['maps', 'cliente'],
    gancho: 'Le vende a decenas de boutiques y las conoce por dentro. Es la puerta más barata a una lista que ya confía en él.',
  },
  fotografia: {
    familia: 'trabaja_con', perfil: 'referidor',
    nombre: 'Fotografía de producto y estudio de e-commerce',
    fuentes: ['instagram', 'maps', 'cliente'],
    gancho: 'Entrega fotos que después nadie sube porque no hay catálogo. El catálogo con IA de Sacs es su siguiente venta.',
  },
  agencia_marketing: {
    familia: 'trabaja_con', perfil: 'consultor',
    nombre: 'Agencia de marketing y community manager de moda',
    fuentes: ['instagram', 'linkedin'],
    gancho: 'Trae tráfico a una tienda que no sabe qué tiene. Le devuelven la campaña como culpa cuando el problema era el surtido.',
  },

  // ── Reúnen a muchos retailers ─────────────────────────────────────────────
  camara: {
    familia: 'reune', perfil: 'referidor', ya: ['Cámaras y asociaciones'],
    nombre: 'Cámara y asociación del sector',
    fuentes: ['directorio', 'maps'],
    gancho: 'Necesita darle algo útil a sus agremiados. Un beneficio de sistema para el padrón es contenido y servicio a la vez.',
  },
  feria: {
    familia: 'reune', perfil: 'referidor', ya: ['Ferias y expos'],
    nombre: 'Feria y expo',
    fuentes: ['directorio'],
    gancho: 'El expositor levanta pedido en papel y lo captura tres días después. Sacs en el stand es servicio al expositor.',
  },
  plaza: {
    familia: 'reune', perfil: 'referidor', ya: ['Plazas y mayoristas de ropa'],
    nombre: 'Plaza y corredor mayorista',
    fuentes: ['maps', 'directorio'],
    gancho: 'Cientos de locales que se conocen entre ellos: lo que adopta uno lo prueban diez.',
  },
  showroom: {
    familia: 'reune', perfil: 'referidor', ya: ['Showrooms'],
    nombre: 'Showroom y representante de marca',
    fuentes: ['instagram', 'directorio'],
    gancho: 'Representa varias marcas y les levanta pedido a las mismas tiendas. Ve el problema de surtido antes que nadie.',
  },
  plataforma_b2b: {
    familia: 'reune', perfil: 'tecnologia', ya: ['Plataformas B2B'],
    nombre: 'Plataforma B2B de mayoreo',
    fuentes: ['directorio', 'linkedin'],
    gancho: 'Sus compradores piden por catálogo y luego no saben qué les llegó. Conectar el pedido con el inventario es integración, no venta.',
  },
  mayorista: {
    familia: 'reune', perfil: 'referidor', ya: ['Mayoristas de calzado'],
    nombre: 'Mayorista que surte a muchas tiendas',
    fuentes: ['maps', 'directorio'],
    gancho: 'Sus clientes le piden reposición tarde y mal. Lo que vende más rápido su tienda es lo que él vuelve a producir.',
  },

  // ── Tienen la audiencia ───────────────────────────────────────────────────
  creador: {
    familia: 'audiencia', perfil: 'referidor', ya: ['Creadora'],
    nombre: 'Creador de contenido de retail y moda',
    fuentes: ['tiktok', 'instagram'],
    gancho: 'Su audiencia son dueñas de tienda que le preguntan con qué llevar el inventario. Hoy contesta gratis; puede cobrar 40 % de por vida.',
  },
  medio: {
    familia: 'audiencia', perfil: 'referidor',
    nombre: 'Medio y newsletter del sector',
    fuentes: ['directorio', 'linkedin'],
    gancho: 'Vive de contenido para retailers; un caso con cifras reales es material que no tiene.',
  },

  // ── Conectan por tecnología ───────────────────────────────────────────────
  pagos: {
    familia: 'conecta', perfil: 'tecnologia',
    nombre: 'Pasarela de pagos y terminal',
    fuentes: ['linkedin', 'directorio'],
    gancho: 'Ya está en el mostrador de la tienda. Conectado al punto de venta deja de ser una terminal suelta.',
  },
  logistica: {
    familia: 'conecta', perfil: 'tecnologia',
    nombre: 'Paquetería, última milla y fulfillment',
    fuentes: ['linkedin', 'directorio'],
    gancho: 'La devolución de moda se la comen ellos. Saber talla y modelo antes del envío baja el reenvío.',
  },
  ecommerce: {
    familia: 'conecta', perfil: 'tecnologia',
    nombre: 'Agencia y desarrollador de e-commerce',
    fuentes: ['linkedin', 'directorio', 'instagram'],
    gancho: 'Monta la tienda en línea y hereda el problema del inventario que no cuadra con el piso.',
  },
  marketplace: {
    familia: 'conecta', perfil: 'tecnologia',
    nombre: 'Marketplace y canal de venta',
    fuentes: ['directorio', 'linkedin'],
    gancho: 'Su vendedor sobrevende porque el stock está en otro lado. Sacs ya conecta cuatro canales.',
  },
  hardware: {
    familia: 'conecta', perfil: 'tecnologia',
    nombre: 'Hardware de tienda (punto de venta, etiquetado, conteo)',
    fuentes: ['maps', 'linkedin'],
    gancho: 'Vende fierro que necesita un sistema detrás; sin software su venta se queda en el mostrador.',
  },
  datos_ia: {
    familia: 'conecta', perfil: 'tecnologia',
    nombre: 'Analítica, IA e integradores',
    fuentes: ['linkedin'],
    gancho: 'Necesita datos limpios de retail para que su modelo sirva. Sacs los tiene por talla, color y tienda.',
  },
};

/** La lista ordenada por familia, como se enseña. */
export function porFamilia(): { familia: TipoAliado['familia']; titulo: string; tipos: (TipoAliado & { clave: string })[] }[] {
  const orden: TipoAliado['familia'][] = ['asesora', 'trabaja_con', 'reune', 'audiencia', 'conecta'];
  return orden.map(f => ({
    familia: f, titulo: FAMILIAS[f],
    tipos: Object.entries(ALIADOS).filter(([, t]) => t.familia === f).map(([clave, t]) => ({ clave, ...t })),
  }));
}

/** El tipo de una cuenta ya cargada, por su `subgiro` viejo. Los subgiros que
 *  existían antes de esta lista se mapean para no volver a cargar a nadie. */
export function tipoDeSubgiro(subgiro?: string | null): string | null {
  const s = String(subgiro || '').trim().toLowerCase();
  if (!s) return null;
  for (const [clave, t] of Object.entries(ALIADOS)) {
    if (clave === s) return clave;
    if ((t.ya || []).some(v => v.toLowerCase() === s)) return clave;
  }
  return null;
}
