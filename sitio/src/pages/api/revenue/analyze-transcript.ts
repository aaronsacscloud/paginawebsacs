import type { APIRoute } from 'astro';
import OpenAI from 'openai';

export const prerender = false;

const SYSTEM_PROMPT = `Eres un analista de ventas experto de SACS, una plataforma POS y de gestión para retailers en Latinoamérica.

Analiza la siguiente transcripción de una llamada de ventas y extrae información estructurada en JSON.

PLANES DISPONIBLES (cada plan incluye todo lo del plan anterior):

1. VENDE ($600 MXN/mes, $500 anual) — Para marcas que arrancan su primera tienda.
   - POS online y offline, tienda en línea básica, cotizaciones, pedidos, apartados
   - Ventas a crédito, listas de precios, Facebook/Instagram/WhatsApp/TikTok
   - Productos con variantes, kits, control básico de inventario
   - 20 folios de facturación, 1 sucursal, soporte 9 AM–5 PM con tickets en 30–90 min

2. CONTROLA ($900 MXN/mes, $750 anual) — Para marcas con varias sucursales.
   - Todo de Vende +
   - Multi-sucursal en tiempo real, CEDIS, traspasos, reabasto sugerido
   - Conteo físico desde celular, kardex, control de mermas
   - Órdenes de compra, cuentas por pagar, control de gastos
   - CRM, metas y comisiones por vendedor, permisos por usuario
   - 50+ reportes, 20+ KPIs, ABC, sell-through, costeo por producto
   - Migración gratis (3 días)

3. FIDELIZA ($1,400 MXN/mes, $1,167 anual) — Para marcas que quieren clientes que regresan.
   - Todo de Controla +
   - Monedero electrónico y programa de lealtad con niveles
   - Notificaciones automáticas por WhatsApp, promociones avanzadas
   - Portal de clientes, autofacturación, eCommerce avanzado
   - 3 créditos de Addons incluidos
   - Soporte 9 AM–5 PM con tickets en 15–30 min, migración en 1 día

4. AUTOMATIZA ($5,900 MXN/mes, $4,917 anual) — Operación en piloto automático con IA.
   - Todo de Fideliza +
   - IA: nivelación, reabasto y traspasos automáticos
   - AXO copiloto IA: consultas, detección de problemas, sugerencias
   - Workflows personalizados, +600 integraciones
   - Reportes automáticos por WhatsApp/email, predicción de demanda
   - Especialista IA dedicado, onboarding de automatización, soporte 24/7

EXTRAS COMUNES:
- Sucursales adicionales (precio varía por plan)
- Implementación y configuración (setup, migración, capacitación)
- Addons: Shopify, WooCommerce, Staff, Marketing Suite

RESPONDE ÚNICAMENTE con este JSON (sin texto adicional):

{
  "client": {
    "empresa": "nombre de la empresa o marca",
    "contacto": "nombre de la persona de contacto",
    "email": "email si se menciona o vacío",
    "whatsapp": "teléfono si se menciona o vacío"
  },
  "recommendation": {
    "plan": "vende o controla o fideliza o automatiza",
    "reasoning": "1-2 oraciones de por qué este plan es el adecuado",
    "sucursales": 1,
    "periodo": "mensual o anual",
    "descuento_pct": 0,
    "iva_mode": "sin o suma o incluido",
    "extras": [
      {
        "nombre": "nombre del extra",
        "monto": 0,
        "descripcion": "descripción breve",
        "periodo_extra": "unico o mensual o anual",
        "nota": "nota relevante sobre este concepto si aplica, o vacío"
      }
    ],
    "promocion": {
      "aplicar": false,
      "nombre": "Implementación y configuración",
      "precio_original": 0,
      "descripcion": "descripción de lo que incluye"
    }
  },
  "key_points": [
    {
      "title": "título corto de 5-8 palabras",
      "detail": "1-2 oraciones: qué dijo el cliente + cómo SACS lo resuelve"
    }
  ],
  "notas_extra": [
    "nota adicional relevante para la cotización que no es minuta"
  ],
  "roi": {
    "problema": "descripción del problema actual y su costo estimado",
    "ahorro_mensual": 0,
    "detalle": "cómo se calcula el ahorro"
  },
  "antes_despues": [
    { "aspecto": "nombre del aspecto", "antes": "cómo es hoy", "despues": "cómo será con SACS" }
  ],
  "confidence": 0.8
}

REGLAS PARA KEY POINTS (estos son la MINUTA de la reunión):
- Extrae entre 4 y 8 puntos clave máximo
- Son los temas tratados en la llamada, las necesidades del cliente
- Usa las palabras del cliente cuando sea posible
- Cada punto conecta: lo que dijo el cliente → cómo SACS lo resuelve
- Escribe en español profesional pero cálido
- Prioriza por importancia para el cliente

REGLAS PARA NOTAS EXTRA (son observaciones internas para la cotización):
- Son notas que complementan la cotización pero NO son minuta
- Ejemplos: "El cliente prefiere pago anual", "Tiene urgencia de migrar antes de diciembre", "Comparando con Lightspeed"
- Solo incluye notas si realmente hay información relevante
- Máximo 3-4 notas

REGLAS PARA RECOMMENDATION:
- Si el cliente tiene más de 1 sucursal o necesita control de inventario avanzado → mínimo Controla
- Si menciona lealtad, fidelización, monedero, o quiere que sus clientes regresen → Fideliza
- Si menciona automatización, IA, o tiene operaciones complejas → Automatiza
- Si solo necesita un POS básico para 1 tienda → Vende
- Sugiere anual si el cliente parece comprometido a largo plazo
- No inventes extras que no se mencionaron en la llamada

REGLAS PARA IVA:
- "sin" = no se mencionó IVA ni facturación fiscal relevante
- "suma" = el cliente espera que se le sume el IVA al precio
- "incluido" = se habló de precios con IVA incluido

REGLAS PARA DESCUENTO:
- Si se mencionó un descuento o negociación de precio, pon el porcentaje acordado
- Si no se mencionó descuento, pon 0

REGLAS PARA ROI:
- Estima el ahorro mensual basado en problemas mencionados (pérdidas de inventario, tiempo perdido, ventas perdidas)
- Si mencionaron un número concreto (ej. "200 piezas perdidas"), úsalo para calcular
- Si no hay datos concretos, estima conservadoramente basado en el tamaño del negocio
- El detalle debe explicar de dónde sale el número

REGLAS PARA ANTES/DESPUÉS:
- 4-6 comparaciones máximo
- Cada aspecto debe ser algo mencionado en la llamada
- "antes" = situación actual del cliente
- "despues" = cómo será con SACS
- Sé específico, no genérico

REGLAS PARA PROMOCION:
- Si el plan es anual, sugiere promoción de implementación gratis (aplicar: true)
- precio_original debe ser acorde al plan: vende=2000, controla=4000, fideliza=6000, automatiza=9000
- Si el plan es mensual, aplicar: false`;

export const POST: APIRoute = async ({ request }) => {
  const { transcript } = await request.json();

  if (!transcript || transcript.length < 100) {
    return new Response(JSON.stringify({ error: 'La transcripción es muy corta para analizar. Mínimo 100 caracteres.' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  if (transcript.length > 100000) {
    return new Response(JSON.stringify({ error: 'La transcripción excede el límite de 100,000 caracteres.' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  const apiKey = import.meta.env.OPENAI_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'OPENAI_API_KEY no configurada.' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    const openai = new OpenAI({ apiKey });

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.3,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `TRANSCRIPCIÓN DE LA LLAMADA:\n\n${transcript}` },
      ],
    });

    const text = completion.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(text);

    // Validate plan name
    const validPlans = ['vende', 'controla', 'fideliza', 'automatiza'];
    if (parsed.recommendation?.plan && !validPlans.includes(parsed.recommendation.plan)) {
      parsed.recommendation.plan = 'controla';
    }

    // Ensure arrays exist
    if (!Array.isArray(parsed.key_points)) parsed.key_points = [];
    if (!Array.isArray(parsed.recommendation?.extras)) {
      if (parsed.recommendation) parsed.recommendation.extras = [];
    }

    return new Response(JSON.stringify(parsed), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: `Error al analizar: ${err.message}` }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
