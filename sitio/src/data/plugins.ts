/**
 * PLUGINS — lo que se le agrega a Sacs desde «Extiende tu Sacs» (3-oct-2026).
 *
 * Pedido del dueño: en el menú «Plataforma», en lugar de los dos rectángulos de abajo («Agenda una demo» y «Empieza
 * gratis», que ya están en la barra), una fila visual de plugins empezando por Staff; «máximo serán 4 o 5». Staff y
 * Administración tienen su página (/plugins/staff, /plugins/administracion); los demás llevan a la página que ya
 * tenían en el sitio. Las descripciones salen de las tarjetas del catálogo de la app (sacs3
 * src/views/sacs-plugins/sacs-plugins.html).
 *
 * Un plugin nuevo = una entrada aquí (miniatura 360×440 en /images/plugins/menu-<slug>.webp) y, si tiene, su página
 * en src/pages/plugins/.
 */
export interface Plugin {
  slug: string;
  nombre: string;
  /** Una línea: qué le agrega a tu Sacs. */
  bajada: string;
  href: string;
  /** Miniatura vertical 360×440 para el menú. */
  imagen: string;
  alt: string;
  nuevo?: boolean;
}

export const plugins: Plugin[] = [
  {
    slug: 'staff',
    nombre: 'Staff',
    bajada: 'Checador, horarios, vacaciones y expedientes de tu equipo.',
    href: '/plugins/staff',
    imagen: '/images/plugins/menu-staff.webp',
    alt: 'Una vendedora llega a la boutique y checa desde su celular',
    nuevo: true,
  },
  {
    slug: 'axo',
    nombre: 'AXO · Operador de IA',
    bajada: 'Le preguntas en lenguaje natural y te arma reportes y tareas.',
    href: '/producto/axo-copiloto-ia',
    imagen: '/images/plugins/menu-axo.webp',
    alt: 'La dueña de una tienda de ropa consulta a AXO en su tablet',
  },
  {
    slug: 'mcp',
    nombre: 'Sacs en tu IA · MCP',
    bajada: 'Todo tu Sacs dentro de Claude, ChatGPT y otros asistentes.',
    href: '/mcp',
    imagen: '/images/plugins/menu-mcp.webp',
    alt: 'Una mujer de traje azul camina frente a una boutique mientras habla con su asistente en el celular',
  },
  {
    slug: 'administracion',
    nombre: 'Administración',
    bajada: 'Gastos, bancos, pagos a proveedores y flujo de efectivo al día.',
    href: '/plugins/administracion',
    imagen: '/images/plugins/menu-administracion.webp',
    alt: 'La dueña de una boutique revisa un recibo junto a su laptop',
  },
];
