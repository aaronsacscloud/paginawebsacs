// Contenido de la guía de entrega de la Suite de Consignación (v2.1, 20-oct-2026).
//
// Objetivo: que la orquestadora implemente con el cliente un flujo ESTÁNDAR
// completo de punta a punta y que las particularidades se prueben, se decidan
// y se anoten ahí mismo. Las sesiones son de dos tipos:
//  · CON EL DUEÑO (sección `dueno: true` al inicio de cada proceso): visión
//    del proceso, resultados que debe ver y TODAS las reglas y políticas del
//    negocio (`decidir`). Firma el dueño.
//  · CON EL EQUIPO (las demás secciones = etapas): el detalle en pantalla con
//    el caso de prueba (una consignataria y las piezas A, B y C). Solo llevan
//    decisiones operativas. Firma el responsable del equipo.
//
// En cada sección:
//   demostrar → «Hacemos… / Debe pasar…» (Correcto / Falla / No aplica);
//               `o: true` = opcional (se oculta en «sesión corta»).
//   decidir   → preguntas que se contestan por escrito.
//   noHace    → lo que el sistema HOY no hace: solo lo ve la orquestadora; se
//               verifica antes y, si el cliente lo necesita, se anota como mejora.
//   pieza     → parte del caso que usa la etapa ('cons', 'A', 'B', 'C', 'ABC').
//   pitch     → texto para leer en voz alta al arrancar.
// Todo «Debe pasar» está revisado contra el código de sacs3/sacs_api (oct-2026).
// Los `id` de sección son la llave de lo capturado: NO se renombran.

export const CASO = [
  {
    "k": "cons",
    "l": "Consignataria de prueba",
    "ph": "Nombre"
  },
  {
    "k": "folio",
    "l": "Folio de la consignataria",
    "ph": "CONS-…"
  },
  {
    "k": "lote",
    "l": "Folio del lote",
    "ph": "LOTE-…"
  },
  {
    "k": "A",
    "l": "Pieza A · se vende de contado",
    "ph": "SKU y descripción"
  },
  {
    "k": "B",
    "l": "Pieza B · se aparta y se devuelve",
    "ph": "SKU y descripción"
  },
  {
    "k": "C",
    "l": "Pieza C · no se vende (vencimiento)",
    "ph": "SKU y descripción"
  },
  {
    "k": "ticketA",
    "l": "Ticket de la venta de A",
    "ph": "Folio del ticket"
  },
  {
    "k": "pedidoB",
    "l": "Apartado de B",
    "ph": "Folio del pedido"
  }
];

export const GUIA = {
  "capitulos": [
    {
      "id": "p0",
      "nombre": "Arranque de la sesión",
      "tipos": [
        "Mejora de UI",
        "Mejora de proceso",
        "Condicional / regla",
        "Bug"
      ],
      "resumen": "Con el dueño: explicar el método, la migración de su tienda en línea y el reporte de migración de datos, y acordar quién participa. Con el equipo: entrar con la cuenta de Agustín, confirmar la suite y anotar el caso de prueba.",
      "secciones": [
        {
          "id": "p0-dueno",
          "dueno": true,
          "nombre": "Arranque con el dueño",
          "donde": "Sesión individual con el dueño",
          "para": "Explicarle cómo será la implementación y acordar quién del equipo participa en cada proceso.",
          "pitch": "Antes de entrar a los procesos vemos dos temas: la migración de su tienda en línea y el reporte de migración de sus datos. Después vamos a implementar la Suite de Consignación en dos tipos de sesión. Con usted revisamos cada proceso a nivel general: cómo funciona de punta a punta, qué resultados debe ver y las reglas de su negocio (comisiones, plazos, pagos, permisos). Con su equipo revisamos el detalle en pantalla, con un caso de prueba en su propia cuenta. Todo lo que salga —dudas, ajustes y mejoras— se anota; al día siguiente se revisa y se pule el proceso hasta que quede tal cual lo necesitan. Cuando un proceso queda, usted lo firma de enterado y pasamos al siguiente.",
          "demostrar": [
            {
              "h": "Le explicamos al dueño cómo será la implementación con el pitch de arriba.",
              "d": "Entiende el método: con él las reglas y decisiones; con el equipo el detalle; se anota, se pule al día siguiente y se firma."
            },
            {
              "h": "Revisamos con él la lista de procesos.",
              "d": "Marca cuáles aplican a su tienda (preparación de piezas, dinámicas)."
            },
            {
              "h": "Acordamos quién del equipo va a cada proceso.",
              "d": "Cada proceso tiene un responsable del equipo."
            }
          ],
          "decidir": [
            "¿Quién del equipo participa en cada proceso?",
            "¿Cuándo son las sesiones con el equipo y la revisión del día siguiente (hora y duración)?",
            "¿La tienda usa preparación de piezas (certificación, fotos, etiquetado) antes de vender?",
            "¿La tienda vende en lives o dinámicas?"
          ],
          "noHace": []
        },
        {
          "id": "p0-ecommerce",
          "dueno": true,
          "nombre": "Tienda en línea (e-commerce)",
          "donde": "Sesión con el dueño",
          "para": "En el transcurso de estos días migramos su tienda en línea con el diseño tal cual está hoy y con todo lo que requiere, con la posibilidad de crear después un diseño innovador. Antes, queremos entender dónde van y cómo trabajan hoy, incluidos los apartados.",
          "pitch": "Su tienda en línea también pasa a Sacscloud. En el transcurso de estos días la migramos con su diseño tal cual está hoy y con todo lo que necesita, para que para sus clientes no cambie nada. Ya con eso funcionando, tenemos la posibilidad de crear un diseño nuevo e innovador cuando ustedes lo decidan. Para hacerlo bien, cuéntennos un poco más de los esfuerzos que han hecho hasta ahora: de dónde vienen, qué es lo que llevan y cómo manejan hoy los apartados.",
          "demostrar": [
            {
              "h": "Le explicamos el plan de la tienda en línea con el pitch de arriba.",
              "d": "Entiende que primero se migra tal cual está y que después existe la posibilidad de un diseño nuevo."
            },
            {
              "h": "Recorremos juntos su tienda en línea actual.",
              "d": "Queda claro qué secciones, funciones e integraciones tiene hoy: lo que no se puede perder en la migración."
            }
          ],
          "decidir": [
            "¿De dónde vienen y dónde van con la tienda en línea? ¿Qué esfuerzos han hecho hasta ahora y qué es lo que llevan?",
            "¿Qué tiene hoy la tienda que no se puede perder (secciones, formas de pago, envíos, integraciones)?",
            "¿Cómo manejan hoy los apartados en línea (anticipo, plazo y cómo se liquidan)?",
            "¿Quieren explorar un diseño nuevo después de la migración? ¿Qué referencias les gustan?",
            "¿Quién de su equipo es el contacto para la tienda en línea?"
          ],
          "noHace": []
        },
        {
          "id": "p0-migracion",
          "dueno": true,
          "nombre": "Reporte de migración de datos",
          "donde": "Sesión con el dueño · reporte de revisión de la migración",
          "para": "Explicarle al dueño cómo se pasa su información a Sacscloud y cómo se comprueba, con el reporte de migración, que llegó completa y cuadra contra su sistema anterior.",
          "demostrar": [
            {
              "h": "Explicamos qué se migra.",
              "d": "Consignatarias (las repetidas se unen por teléfono), piezas con su estado, precio y fotos, lotes y contratos, compradores, saldo a favor, lo que se le debe a cada consignataria y los apartados."
            },
            {
              "h": "Mostramos el reporte de migración.",
              "d": "Por cada tipo de dato dice cuántos se esperaban, cuántos llegaron, cuáles faltan o sobran y qué campos no coinciden."
            },
            {
              "h": "Revisamos el cuadre de totales.",
              "d": "Existencias por sucursal, lo que se debe a las consignatarias, saldo a favor y apartados cuadran; el reporte termina en «CUADRA»."
            },
            {
              "h": "Explicamos los pasos que siguen.",
              "d": "Primero una muestra que se revisa en pantalla; luego la carga completa con su autorización, su revisión y el cuadre; al final, la fecha de corte con la última actualización antes de encender los avisos."
            }
          ],
          "decidir": [
            "¿Quién del cliente revisa y autoriza el reporte de migración?",
            "¿Cuál es la fecha de corte para la última actualización de datos?",
            "¿Hay algún dato que no aparece en el reporte y que necesitan en Sacscloud?"
          ],
          "noHace": [
            "Antes de la sesión, generar el reporte más reciente (scripts/vendetucloset/comparar.js) y llevarlo; si no dice «CUADRA», revisar las diferencias antes de mostrarlo.",
            "Hay 33 piezas vendidas con ajuste manual en revisión (INSTRUCCIONES-AWS §7, 19-oct): confirmar su estado antes de hablar de montos."
          ]
        },
        {
          "id": "p0-prep",
          "nombre": "Arranque con el equipo",
          "donde": "app.sacscloud.com, con la cuenta de Agustín",
          "para": "Entrar a la cuenta, confirmar que la suite está instalada y explicarle al equipo cómo será la sesión antes de empezar el primer proceso.",
          "pitch": "Vamos a recorrer en pantalla cómo se trabaja la consignación en el día a día, proceso por proceso, con un caso de prueba en la cuenta de la tienda. Las reglas ya las definió el dueño; aquí vemos que el sistema funcione como ustedes trabajan. Si algo no cuadra, confunde o falta, lo anotamos: al día siguiente se revisa y se pule. Cuando el proceso queda, lo firma el responsable y pasamos al siguiente.",
          "demostrar": [
            {
              "h": "Entramos a app.sacscloud.com con la cuenta de Agustín.",
              "d": "Entra a la cuenta de Vende Tu Closet."
            },
            {
              "h": "Revisamos arriba a la izquierda.",
              "d": "Dice «Consignación»: la suite está instalada."
            },
            {
              "h": "Le explicamos al equipo cómo será la sesión con el pitch de arriba.",
              "d": "El equipo entiende el método: se demuestra, se anota y se pule al día siguiente."
            },
            {
              "h": "Confirmamos que están las personas de este proceso.",
              "d": "Está el responsable que acordó el dueño y quienes lo hacen en la tienda."
            }
          ],
          "decidir": [],
          "noHace": [
            "Antes de mostrar Buscar en SACS, confirmar que lo nuevo ya está publicado en app.sacscloud.com (el front se publica a mano).",
            "Confirmar que la revisión diaria de vencimientos esté encendida para la cuenta vendetucloset.",
            "Cuatro avisos por WhatsApp de consignación (pieza disponible, venta revertida, recuperación y no auténtica) están apagados mientras Meta aprueba sus plantillas; por correo sí salen."
          ]
        },
        {
          "id": "p0-caso",
          "caso": true,
          "nombre": "Caso de prueba",
          "donde": "Se llena conforme se crean los datos en la sesión",
          "para": "Una consignataria de prueba y tres piezas que recorren toda la sesión: la A se vende de contado, la B se aparta y la clienta la devuelve, y la C no se vende y llega a vencimiento. Se crean en el Proceso 1 y aquí se anotan sus folios para tenerlos a la mano en cada etapa.",
          "demostrar": [],
          "decidir": [],
          "noHace": []
        }
      ]
    },
    {
      "id": "p1",
      "nombre": "Alta, piezas y contrato",
      "tipos": [
        "Mejora de UI",
        "Mejora de proceso",
        "Condicional / regla",
        "Bug"
      ],
      "resumen": "De la plantilla de contrato al alta de la consignataria con sus tres piezas y la firma. Al terminar, las piezas están en inventario.",
      "diagrama": {
        "titulo": "Al firmar, la consignataria queda activa y sus piezas entran al inventario",
        "lectura": "La plantilla fija las reglas; el asistente da de alta a la consignataria (paso 1), sus piezas (paso 2) y el contrato (paso 3). La firma puede ser en la tableta o a distancia.",
        "nodos": [
          {
            "id": "a",
            "c": 0,
            "r": 0,
            "t": "Plantilla",
            "s": "reglas",
            "sec": "p1-plantilla"
          },
          {
            "id": "b",
            "c": 1,
            "r": 0,
            "t": "Alta",
            "s": "paso 1 · datos",
            "sec": "p1-alta"
          },
          {
            "id": "c",
            "c": 2,
            "r": 0,
            "t": "Piezas",
            "s": "paso 2 · A, B y C",
            "sec": "p1-piezas"
          },
          {
            "id": "d",
            "c": 3,
            "r": 0,
            "t": "Contrato",
            "s": "paso 3 · firma",
            "sec": "p1-firma"
          },
          {
            "id": "e",
            "c": 4,
            "r": 0,
            "t": "Activa",
            "s": "piezas en inventario",
            "sec": "p1-resultado",
            "fin": true
          },
          {
            "id": "f",
            "c": 3,
            "r": 1,
            "t": "Firma remota",
            "s": "enlace de 48 h",
            "sec": "p1-firma"
          }
        ],
        "flechas": [
          {
            "de": "a",
            "a": "b"
          },
          {
            "de": "b",
            "a": "c"
          },
          {
            "de": "c",
            "a": "d"
          },
          {
            "de": "d",
            "a": "e"
          },
          {
            "de": "d",
            "a": "f",
            "et": "o a distancia"
          }
        ]
      },
      "secciones": [
        {
          "id": "p1-dueno",
          "dueno": true,
          "nombre": "Visión con el dueño",
          "para": "Que el dueño vea cómo entra una consignataria con sus piezas y defina las reglas que se copian a cada contrato.",
          "demostrar": [
            {
              "h": "Recorremos con el dueño el mapa del proceso.",
              "d": "Entiende el camino de punta a punta y qué resultado sale al final."
            },
            {
              "h": "Abrimos el contrato firmado del caso de prueba (o uno de ejemplo).",
              "d": "Refleja sus reglas: comisión, vigencia, forma y plazo de pago, y qué pasa si no se vende."
            },
            {
              "h": "Calculamos juntos cuánto le toca a la consignataria por una pieza.",
              "d": "Precio − comisión − servicios: coincide con su política."
            }
          ],
          "decidir": [
            "% de comisión de la tienda y si es negociable (mínimo y máximo).",
            "Vigencia del contrato y si se renueva sola (cuántos días).",
            "Cada cuándo se le paga a la consignataria (inmediata, semanal, quincenal o mensual) y en cuántos días.",
            "Días de espera antes de pagar (para cubrir devoluciones del cliente final).",
            "Qué pasa si no se vende: rebaja (cuánto %), devolución o renovación, y a los cuántos días.",
            "Servicios con cargo (certificación, limpieza, fotos, reparación) y si se cobran al firmar o se descuentan al pagar.",
            "Qué datos son obligatorios en el alta (datos bancarios, identificación, dirección).",
            "¿Se firma en tienda, a distancia o ambos?"
          ],
          "noHace": []
        },
        {
          "id": "p1-plantilla",
          "nombre": "Plantilla de contrato",
          "donde": "Consignación › Configuración › «Plantillas de contrato (reglas)»",
          "para": "La plantilla fija las reglas que se copian a cada contrato: comisión, vigencia, renovación, cuándo se paga y qué pasa si no se vende. Hasta 5 plantillas, una predeterminada.",
          "demostrar": [
            {
              "h": "Abrimos la plantilla predeterminada (★).",
              "d": "Muestra comisión, vigencia, renovación, frecuencia y días de pago, días de espera y regla de no venta."
            },
            {
              "h": "Ajustamos los valores a la política de la tienda y guardamos.",
              "d": "Se guardan y quedan como predeterminados para los contratos nuevos."
            },
            {
              "h": "Revisamos el texto de las cláusulas.",
              "d": "Las variables (comisión, forma de pago, no venta, vigencia) se llenan con los valores de la plantilla."
            }
          ],
          "decidir": [],
          "noHace": []
        },
        {
          "id": "p1-alta",
          "nombre": "Alta de la consignataria",
          "pieza": "cons",
          "donde": "Consignación › Consignatarios › «Nuevo Consignatario» · paso 1 Datos",
          "para": "Se capturan datos personales, de contacto y bancarios. El sistema asigna el folio CONS-, avisa si el correo o el teléfono ya existen y valida la CLABE.",
          "demostrar": [
            {
              "h": "Damos de alta a la consignataria de prueba.",
              "d": "Recibe su folio CONS- (anótalo en el caso de prueba)."
            },
            {
              "h": "Subimos su identificación y una foto de ingreso.",
              "d": "Se ven después en su perfil."
            },
            {
              "h": "Escribimos un teléfono o correo que ya existe.",
              "d": "El sistema avisa del posible duplicado.",
              "o": true
            },
            {
              "h": "Capturamos una CLABE con un dígito mal.",
              "d": "La rechaza con un mensaje claro.",
              "o": true
            }
          ],
          "decidir": [],
          "noHace": []
        },
        {
          "id": "p1-piezas",
          "nombre": "Piezas del lote",
          "pieza": "ABC",
          "donde": "Asistente · paso 2 Productos («Contrato del lote» y «Agregar producto rápido»)",
          "para": "Se elige la plantilla del lote y se agregan las piezas con precio, fotos y servicios. Cada pieza recibe su SKU y el lote su folio LOTE-. El sistema calcula la comisión y lo que le toca a la consignataria.",
          "nota": "Cómo elige el % de comisión: el negociado (dentro de mínimo y máximo); si no, la tabla por precio; si no, la tabulada (menos de $6,000 = 30%, desde $6,000 = 20%); si no, el de la plantilla.",
          "demostrar": [
            {
              "h": "Agregamos las piezas A, B y C con precio y fotos.",
              "d": "Cada una recibe su SKU y el lote su folio LOTE- (anótalos en el caso de prueba)."
            },
            {
              "h": "Revisamos la comisión y el pago estimado de la pieza A.",
              "d": "Pago = precio − comisión − servicios que se descuentan; lo calculamos juntos y coincide."
            },
            {
              "h": "Intentamos cambiar la plantilla después de la primera pieza.",
              "d": "Queda bloqueada para ese lote.",
              "o": true
            },
            {
              "h": "Capturamos por error un precio 70% más bajo.",
              "d": "Pide confirmación antes de guardarlo.",
              "o": true
            }
          ],
          "decidir": [
            "Cómo se etiqueta físicamente la pieza y qué código lleva la etiqueta."
          ],
          "noHace": []
        },
        {
          "id": "p1-firma",
          "nombre": "Contrato y firma",
          "donde": "Asistente · paso 3 Contrato: «Finalizar y Firmar» o «Enviar enlace para firmar»",
          "para": "Antes de firmar se revisan los datos bancarios (si la plantilla los exige). La firma puede ser en la tableta o a distancia, con un enlace por correo que dura 48 horas.",
          "demostrar": [
            {
              "h": "Revisamos el contrato en pantalla con la consignataria.",
              "d": "Muestra sus datos, las tres piezas, las reglas y las cláusulas."
            },
            {
              "h": "Firma en la tableta y tocamos «Finalizar y Firmar».",
              "d": "El contrato queda firmado."
            },
            {
              "h": "Descargamos el PDF del contrato.",
              "d": "Lleva logo y un código QR de verificación."
            },
            {
              "h": "Enviamos el enlace para firmar a distancia a otro correo.",
              "d": "Abre sin cuenta y deja firmar.",
              "o": true
            }
          ],
          "decidir": [
            "¿Se imprime la responsiva de ingreso de las piezas?"
          ],
          "noHace": [
            "Cancelar un contrato no tiene botón en pantalla; la adenda sí («Más acciones › Crear adenda»)."
          ]
        },
        {
          "id": "p1-resultado",
          "nombre": "Consignataria activa y piezas en inventario",
          "pieza": "A",
          "donde": "Perfil de la consignataria (Resumen / Productos / Contrato / Liquidaciones) e inventario",
          "para": "Al firmar, la consignataria queda activa y las piezas entran al inventario (o a preparación, si la tienda la usa).",
          "demostrar": [
            {
              "h": "Abrimos su perfil.",
              "d": "Está activa, con sus pestañas Resumen, Productos, Contrato y Liquidaciones."
            },
            {
              "h": "Buscamos la pieza A en el inventario de la sucursal.",
              "d": "Aparece con su precio y existencia 1."
            },
            {
              "h": "Imprimimos la responsiva de ingreso.",
              "d": "Sale con las piezas recibidas.",
              "o": true
            }
          ],
          "decidir": [],
          "noHace": []
        }
      ]
    },
    {
      "id": "p2",
      "nombre": "Preparación de piezas",
      "tipos": [
        "Mejora de UI",
        "Mejora de proceso",
        "Condicional / regla",
        "Bug"
      ],
      "resumen": "Solo si la tienda la usa: certificación, limpieza, fotos, reparación y etiquetado antes de poner la pieza a la venta.",
      "diagrama": {
        "titulo": "Una pieza solo se vende cuando completa sus pasos obligatorios",
        "lectura": "Con la preparación activa, cada pieza firmada entra en proceso y no se vende hasta completar sus pasos. Un costo alto espera aprobación; una pieza retenida deja de venderse.",
        "nodos": [
          {
            "id": "a",
            "c": 0,
            "r": 0,
            "t": "Firma",
            "s": "contrato",
            "sec": "p2-cola"
          },
          {
            "id": "b",
            "c": 1,
            "r": 0,
            "t": "En proceso",
            "s": "no se vende",
            "sec": "p2-cola"
          },
          {
            "id": "c",
            "c": 2,
            "r": 0,
            "t": "Pasos",
            "s": "certificación, fotos",
            "sec": "p2-pasos"
          },
          {
            "id": "d",
            "c": 3,
            "r": 0,
            "t": "Disponible",
            "s": "a la venta",
            "sec": "p2-pasos",
            "fin": true
          },
          {
            "id": "f",
            "c": 2,
            "r": 1,
            "t": "Costo extra",
            "s": "por aprobar",
            "sec": "p2-cargos"
          },
          {
            "id": "g",
            "c": 3,
            "r": 1,
            "t": "Retenida",
            "s": "pausa la venta",
            "sec": "p2-excepciones"
          }
        ],
        "flechas": [
          {
            "de": "a",
            "a": "b"
          },
          {
            "de": "b",
            "a": "c"
          },
          {
            "de": "c",
            "a": "d",
            "et": "completa"
          },
          {
            "de": "c",
            "a": "f",
            "et": "costo"
          },
          {
            "de": "d",
            "a": "g",
            "et": "retener"
          }
        ]
      },
      "secciones": [
        {
          "id": "p2-dueno",
          "dueno": true,
          "nombre": "Visión con el dueño",
          "para": "Que el dueño decida si las piezas pasan por preparación antes de venderse y con qué reglas de costos.",
          "demostrar": [
            {
              "h": "Recorremos con el dueño el mapa del proceso.",
              "d": "Entiende el camino de punta a punta y qué resultado sale al final."
            },
            {
              "h": "Abrimos la cola de preparación.",
              "d": "Ve qué pasos se cumplen antes de vender y en qué va cada pieza.",
              "o": true
            }
          ],
          "decidir": [
            "Qué pasos aplica la tienda y cuáles son obligatorios.",
            "Tope de cargos y umbral de aprobación.",
            "Penalización por pieza falsa (por defecto $1,500)."
          ],
          "noHace": []
        },
        {
          "id": "p2-cola",
          "nombre": "La cola de preparación",
          "pieza": "ABC",
          "donde": "Consignación › Colas de proceso (vistas Cola y Kanban)",
          "para": "Con la preparación activa (Configuración › «Proceso post-contrato»), cada pieza firmada entra en proceso y no se puede vender hasta completar sus pasos obligatorios.",
          "demostrar": [
            {
              "h": "Abrimos la cola.",
              "d": "Están las piezas A, B y C con sus pasos pendientes."
            },
            {
              "h": "Buscamos la pieza A en caja.",
              "d": "No aparece para vender mientras está en preparación."
            }
          ],
          "decidir": [
            "Quién es responsable de cada paso."
          ],
          "noHace": []
        },
        {
          "id": "p2-pasos",
          "nombre": "Completar los pasos",
          "pieza": "ABC",
          "donde": "Colas de proceso › pieza › «Completar [paso]» › «Guardar y completar»",
          "para": "Cada paso pide sus datos: certificación (resultado, certificadora, número y una evidencia), fotos (mínimo 3), reparación (descripción) y etiquetado (confirmar la etiqueta colocada).",
          "demostrar": [
            {
              "h": "Completamos los pasos de la pieza A con sus fotos y evidencias.",
              "d": "Al terminar el último obligatorio queda disponible y la consignataria recibe aviso."
            },
            {
              "h": "Completamos los pasos de B y C.",
              "d": "Las tres quedan disponibles."
            },
            {
              "h": "Intentamos completar un paso sin sus datos.",
              "d": "No deja y explica qué falta.",
              "o": true
            },
            {
              "h": "Abrimos la cadena de custodia de la pieza A.",
              "d": "Muestra quién hizo cada paso y cuándo.",
              "o": true
            }
          ],
          "decidir": [],
          "noHace": [
            "No hay editor en pantalla para cambiar los campos que pide cada paso."
          ]
        },
        {
          "id": "p2-cargos",
          "nombre": "Costos y cargos",
          "donde": "Colas de proceso › costo real del paso; «Cargos pendientes de aprobación»",
          "para": "El costo real de un paso se vuelve cargo a la consignataria; arriba del umbral espera aprobación. Los servicios se pueden cobrar al firmar (entran al corte de caja) o descontarse al pagarle.",
          "demostrar": [
            {
              "h": "Capturamos un costo de limpieza arriba del umbral.",
              "d": "Aparece en «Cargos pendientes de aprobación» con Aprobar y Rechazar.",
              "o": true
            }
          ],
          "decidir": [],
          "noHace": [
            "Un cargo pendiente ya no se puede aprobar si la pieza se vendió; se ajusta a mano en lo que se le debe a la consignataria."
          ]
        },
        {
          "id": "p2-excepciones",
          "nombre": "Retener, no apta o falsa",
          "donde": "Detalle de la pieza › «Retener (pausar venta)» / «Liberar» / «No apta» / «Fake»",
          "para": "Retener pausa la venta y quita la pieza de la tienda en línea. «No apta» la deja lista para devolver. «Fake» genera el cobro de penalización (no se usa con las piezas del caso: es un cobro real).",
          "demostrar": [
            {
              "h": "Retenemos la pieza C y luego la liberamos.",
              "d": "Mientras está retenida no se vende; al liberarla vuelve a disponible.",
              "o": true
            }
          ],
          "decidir": [],
          "noHace": []
        }
      ]
    },
    {
      "id": "p3",
      "nombre": "Venta",
      "tipos": [
        "Mejora de UI",
        "Mejora de proceso",
        "Condicional / regla",
        "Bug"
      ],
      "resumen": "La pieza A se vende de contado con descuento y la pieza B se aparta y se liquida. Cada venta genera lo que se le debe a la consignataria.",
      "diagrama": {
        "titulo": "Cada venta genera lo que se le debe a la consignataria",
        "lectura": "La pieza A se cobra en caja y queda vendida con su pago pendiente. La pieza B se aparta y se vende cuando el pedido queda pagado.",
        "nodos": [
          {
            "id": "a",
            "c": 0,
            "r": 0,
            "t": "Disponible",
            "s": "pieza A",
            "sec": "p3-contado"
          },
          {
            "id": "b",
            "c": 1,
            "r": 0,
            "t": "Caja",
            "s": "contado + descuento",
            "sec": "p3-contado"
          },
          {
            "id": "c",
            "c": 2,
            "r": 0,
            "t": "Vendida",
            "s": "perfil y aviso",
            "sec": "p3-perfil"
          },
          {
            "id": "d",
            "c": 3,
            "r": 0,
            "t": "Por pagar",
            "s": "a la consignataria",
            "sec": "p3-perfil",
            "fin": true
          },
          {
            "id": "e",
            "c": 1,
            "r": 1,
            "t": "Apartado",
            "s": "pieza B",
            "sec": "p3-apartado"
          },
          {
            "id": "f",
            "c": 2,
            "r": 1,
            "t": "Pagado",
            "s": "pasa a vendida",
            "sec": "p3-apartado"
          }
        ],
        "flechas": [
          {
            "de": "a",
            "a": "b"
          },
          {
            "de": "b",
            "a": "c"
          },
          {
            "de": "c",
            "a": "d"
          },
          {
            "de": "a",
            "a": "e",
            "et": "se aparta"
          },
          {
            "de": "e",
            "a": "f"
          }
        ]
      },
      "secciones": [
        {
          "id": "p3-dueno",
          "dueno": true,
          "nombre": "Visión con el dueño",
          "para": "Que el dueño vea qué pasa con el dinero en cada venta y defina las reglas de descuentos y apartados.",
          "demostrar": [
            {
              "h": "Recorremos con el dueño el mapa del proceso.",
              "d": "Entiende el camino de punta a punta y qué resultado sale al final."
            },
            {
              "h": "Revisamos la venta de la pieza A ya hecha por el equipo.",
              "d": "Ve cuánto se vendió, cuánto gana la tienda y cuánto se le debe a la consignataria."
            }
          ],
          "decidir": [
            "¿El descuento lo absorbe la consignataria o la tienda?",
            "¿El pago a la consignataria se calcula con o sin IVA?",
            "¿Se apartan piezas consignadas? ¿Con qué plazo y anticipo?"
          ],
          "noHace": []
        },
        {
          "id": "p3-contado",
          "nombre": "Venta de contado con descuento",
          "pieza": "A",
          "donde": "Punto de venta",
          "para": "Solo se venden piezas disponibles. Al cobrar se guarda quién vendió y en qué sucursal, se calcula la comisión y lo que le toca a la consignataria, y se le avisa.",
          "nota": "Base del cálculo: el precio cobrado (con descuento y con IVA). Pago a la consignataria = base − comisión − servicios pendientes. Por defecto el descuento lo absorbe la consignataria.",
          "demostrar": [
            {
              "h": "Escaneamos la pieza A en caja.",
              "d": "Aparece con su precio."
            },
            {
              "h": "Aplicamos un descuento y cobramos.",
              "d": "El ticket sale normal (anota su folio en el caso de prueba)."
            },
            {
              "h": "Buscamos una pieza que no está disponible (en preparación, retenida o vencida).",
              "d": "No aparece para vender.",
              "o": true
            }
          ],
          "decidir": [],
          "noHace": [
            "El pago estimado del contrato se calcula sin IVA y el de la venta con IVA; con IVA configurado pueden no coincidir."
          ]
        },
        {
          "id": "p3-perfil",
          "nombre": "Lo que ve la tienda después de vender",
          "pieza": "A",
          "donde": "Perfil de la consignataria › Productos y Liquidaciones",
          "para": "La pieza pasa a vendida, el lote cambia de estado y se genera lo que se le debe a la consignataria.",
          "demostrar": [
            {
              "h": "Abrimos el perfil de la consignataria › Productos.",
              "d": "La pieza A dice «Vendida»."
            },
            {
              "h": "Abrimos la pestaña Liquidaciones.",
              "d": "Aparece lo que se le debe por la pieza A, con su fecha de pago."
            },
            {
              "h": "Calculamos juntos el monto.",
              "d": "Coincide: precio cobrado − comisión − servicios."
            },
            {
              "h": "Revisamos el correo de la consignataria.",
              "d": "Llegó el aviso de venta."
            }
          ],
          "decidir": [],
          "noHace": []
        },
        {
          "id": "p3-apartado",
          "nombre": "Apartado",
          "pieza": "B",
          "donde": "Pedidos / Apartados",
          "para": "Un apartado reserva la pieza; se vende cuando el pedido queda pagado y se libera si se cancela.",
          "demostrar": [
            {
              "h": "Apartamos la pieza B a una clienta con un anticipo.",
              "d": "La pieza queda apartada y no se puede vender a otra persona."
            },
            {
              "h": "Liquidamos el pedido.",
              "d": "La pieza B pasa a vendida y aparece en lo que se le debe a la consignataria (anota el folio del pedido)."
            },
            {
              "h": "Cancelamos otro apartado de prueba.",
              "d": "Su pieza vuelve a disponible.",
              "o": true
            }
          ],
          "decidir": [],
          "noHace": []
        }
      ]
    },
    {
      "id": "p4",
      "nombre": "Devolución del cliente final",
      "tipos": [
        "Mejora de UI",
        "Mejora de proceso",
        "Condicional / regla",
        "Bug"
      ],
      "resumen": "La clienta devuelve la pieza B antes de que se le pague a la consignataria: la venta se revierte sola y la pieza vuelve a la venta.",
      "diagrama": {
        "titulo": "Antes de pagarle a la consignataria, la devolución se revierte sola",
        "lectura": "Si a la consignataria aún no se le paga la pieza, la devolución en caja cancela lo que se le debe y la pieza vuelve a la venta. Si ya se le pagó, se resuelve con «Cliente devolvió» (proceso 8).",
        "nodos": [
          {
            "id": "a",
            "c": 0,
            "r": 0,
            "t": "Venta",
            "s": "pieza B",
            "sec": "p4-devolucion"
          },
          {
            "id": "b",
            "c": 1,
            "r": 0,
            "t": "Devolución",
            "s": "en caja",
            "sec": "p4-devolucion"
          },
          {
            "id": "c",
            "c": 2,
            "r": 0,
            "t": "¿Ya se pagó?",
            "s": "a la consignataria",
            "sec": "p4-devolucion"
          },
          {
            "id": "d",
            "c": 3,
            "r": 0,
            "t": "Se revierte",
            "s": "vuelve a la venta",
            "sec": "p4-devolucion",
            "fin": true
          },
          {
            "id": "e",
            "c": 2,
            "r": 1,
            "t": "Cliente devolvió",
            "s": "proceso 8",
            "sec": "p4-devolucion"
          }
        ],
        "flechas": [
          {
            "de": "a",
            "a": "b"
          },
          {
            "de": "b",
            "a": "c"
          },
          {
            "de": "c",
            "a": "d",
            "et": "no"
          },
          {
            "de": "c",
            "a": "e",
            "et": "sí"
          }
        ]
      },
      "secciones": [
        {
          "id": "p4-dueno",
          "dueno": true,
          "nombre": "Visión con el dueño",
          "para": "Que el dueño entienda qué pasa cuando el cliente final devuelve una pieza y defina su política.",
          "demostrar": [
            {
              "h": "Recorremos con el dueño el mapa del proceso.",
              "d": "Entiende el camino de punta a punta y qué resultado sale al final."
            },
            {
              "h": "Explicamos con el caso la diferencia entre devolver antes o después de pagarle a la consignataria.",
              "d": "Entiende cuándo se revierte sola y cuándo hay que recuperar lo pagado."
            }
          ],
          "decidir": [
            "¿Cuántos días tiene el cliente final para devolver? (Los días de espera antes de pagar deben cubrirlos.)",
            "¿Qué pasa con la comisión del vendedor cuando hay devolución?"
          ],
          "noHace": []
        },
        {
          "id": "p4-devolucion",
          "nombre": "Devolución en caja",
          "pieza": "B",
          "donde": "Devolución o cancelación de la venta en caja (o del pedido)",
          "para": "Si a la consignataria aún no se le paga esa pieza, la venta se revierte sola: se cancela lo que se le debe, la pieza vuelve a disponible y se le avisa.",
          "demostrar": [
            {
              "h": "Hacemos la devolución del pedido de la pieza B.",
              "d": "La devolución se registra normal en caja."
            },
            {
              "h": "Abrimos el perfil de la consignataria.",
              "d": "La pieza B vuelve a disponible y ya no aparece en lo que se le debe."
            },
            {
              "h": "Escaneamos la pieza B en caja.",
              "d": "Se puede volver a vender."
            },
            {
              "h": "Revisamos el correo de la consignataria.",
              "d": "Llegó el aviso de venta revertida.",
              "o": true
            }
          ],
          "decidir": [],
          "noHace": [
            "La comisión del vendedor no se descuenta sola si su periodo ya se aprobó o pagó."
          ]
        }
      ]
    },
    {
      "id": "p5",
      "nombre": "Pago a la consignataria",
      "tipos": [
        "Mejora de UI",
        "Mejora de proceso",
        "Condicional / regla",
        "Bug"
      ],
      "resumen": "Lo que se le debe por la pieza A: fecha de pago, días de espera, pago (en dinero o saldo a favor), comprobante y estado de cuenta.",
      "diagrama": {
        "titulo": "La consignataria cobra en dinero o en saldo a favor, con su comprobante",
        "lectura": "La venta genera lo que se le debe con su fecha de pago. Pasados los días de espera se paga y se emite el comprobante. El pago también puede ir a saldo a favor, que usa para comprar en la tienda.",
        "nodos": [
          {
            "id": "a",
            "c": 0,
            "r": 0,
            "t": "Vendida",
            "s": "pieza A",
            "sec": "p5-porpagar"
          },
          {
            "id": "b",
            "c": 1,
            "r": 0,
            "t": "Por pagar",
            "s": "folio LIQ-",
            "sec": "p5-porpagar"
          },
          {
            "id": "c",
            "c": 2,
            "r": 0,
            "t": "Espera",
            "s": "días acordados",
            "sec": "p5-porpagar"
          },
          {
            "id": "d",
            "c": 3,
            "r": 0,
            "t": "Pago",
            "s": "dinero",
            "sec": "p5-pagar"
          },
          {
            "id": "e",
            "c": 4,
            "r": 0,
            "t": "Comprobante",
            "s": "y estado de cuenta",
            "sec": "p5-pagar",
            "fin": true
          },
          {
            "id": "f",
            "c": 3,
            "r": 1,
            "t": "Saldo a favor",
            "s": "+ bono",
            "sec": "p5-saldo"
          },
          {
            "id": "g",
            "c": 4,
            "r": 1,
            "t": "Compra",
            "s": "en la tienda",
            "sec": "p5-saldo"
          }
        ],
        "flechas": [
          {
            "de": "a",
            "a": "b"
          },
          {
            "de": "b",
            "a": "c"
          },
          {
            "de": "c",
            "a": "d"
          },
          {
            "de": "d",
            "a": "e"
          },
          {
            "de": "d",
            "a": "f",
            "et": "o a saldo"
          },
          {
            "de": "f",
            "a": "g"
          }
        ]
      },
      "secciones": [
        {
          "id": "p5-dueno",
          "dueno": true,
          "nombre": "Visión con el dueño",
          "para": "Que el dueño defina cómo y cuándo se le paga a las consignatarias.",
          "demostrar": [
            {
              "h": "Recorremos con el dueño el mapa del proceso.",
              "d": "Entiende el camino de punta a punta y qué resultado sale al final."
            },
            {
              "h": "Revisamos lo que se le debe a la consignataria de prueba y su estado de cuenta.",
              "d": "Ve fechas de pago, días de espera y lo pagado."
            }
          ],
          "decidir": [
            "¿Quién del equipo paga a las consignatarias y cada cuándo?",
            "¿Necesitan retenciones fiscales o factura de lo que se le paga a la consignataria?",
            "¿Ofrecen saldo a favor? ¿Con qué bono?"
          ],
          "noHace": []
        },
        {
          "id": "p5-porpagar",
          "nombre": "Lo que se le debe",
          "pieza": "A",
          "donde": "Perfil › Liquidaciones («Por pagar al consignatario», «Total a Liquidar», «Próximo pago»)",
          "para": "Cada venta genera lo que se le debe (folio LIQ-). Con pago semanal, quincenal o mensual se juntan en un solo corte. La fecha de pago es la venta más los días de pago.",
          "demostrar": [
            {
              "h": "Abrimos Liquidaciones.",
              "d": "La pieza A aparece con su folio LIQ-, monto y fecha de pago."
            },
            {
              "h": "Intentamos pagar antes de que terminen los días de espera.",
              "d": "No deja y lo explica."
            }
          ],
          "decidir": [],
          "noHace": [
            "No hay una vista con lo que se le debe a todas las consignatarias juntas; se ve por consignataria o con «vencido» y «por pagar» en Buscar en SACS."
          ]
        },
        {
          "id": "p5-pagar",
          "nombre": "Pagar y comprobante",
          "pieza": "A",
          "donde": "Liquidaciones › «Pagar seleccionadas» / «Liquidar (dividir pago)» › «Estado de cuenta»",
          "para": "Se paga total o parcial. Al pagar, la pieza pasa a liquidada y se emite el comprobante.",
          "nota": "Para pagar en la sesión hace falta que hayan pasado los días de espera: usa una plantilla de prueba con 0 días o una venta anterior ya vencida.",
          "demostrar": [
            {
              "h": "Pagamos lo que se le debe por la pieza A.",
              "d": "La pieza pasa a «Liquidada»."
            },
            {
              "h": "Descargamos y enviamos el comprobante.",
              "d": "La consignataria lo recibe por correo."
            },
            {
              "h": "Abrimos «Estado de cuenta».",
              "d": "Cuadra lo vendido, lo pagado y lo pendiente."
            }
          ],
          "decidir": [],
          "noHace": [
            "No calcula retenciones de ISR/IVA ni emite factura de la liquidación.",
            "Un pago en efectivo a la consignataria no se resta solo del corte de caja."
          ]
        },
        {
          "id": "p5-saldo",
          "nombre": "Pago en saldo a favor",
          "donde": "Perfil › tarjeta «Saldo a favor» › «Liquidar a saldo»; caja: método «Tarjeta de lealtad»",
          "para": "En vez de dinero, el pago se convierte en saldo a favor (más el bono configurado) que la consignataria usa para comprar en la tienda. Lo que viene de consignación no caduca.",
          "demostrar": [
            {
              "h": "Liquidamos a saldo lo que se le debe por otra venta.",
              "d": "Su saldo sube con el bono.",
              "o": true
            },
            {
              "h": "En caja, la consignataria paga una compra con «Tarjeta de lealtad».",
              "d": "Se descuenta de su saldo.",
              "o": true
            }
          ],
          "decidir": [],
          "noHace": [
            "El pago mixto (saldo + dinero) no da bono."
          ]
        }
      ]
    },
    {
      "id": "p6",
      "nombre": "Comisión del vendedor",
      "tipos": [
        "Mejora de UI",
        "Mejora de proceso",
        "Condicional / regla",
        "Bug"
      ],
      "resumen": "La venta de la pieza A cuenta para la comisión de quien la vendió: se calcula, se aprueba y se paga en su periodo.",
      "diagrama": {
        "titulo": "La venta entra a la comisión del vendedor en su periodo",
        "lectura": "El plan define sobre qué se paga. Al cerrar el periodo se calcula, se aprueba y se manda a lo que se le debe al vendedor.",
        "nodos": [
          {
            "id": "a",
            "c": 0,
            "r": 0,
            "t": "Venta",
            "s": "pieza A",
            "sec": "p6-periodo"
          },
          {
            "id": "b",
            "c": 1,
            "r": 0,
            "t": "Plan",
            "s": "venta o margen",
            "sec": "p6-plan"
          },
          {
            "id": "c",
            "c": 2,
            "r": 0,
            "t": "Calcular",
            "s": "periodo",
            "sec": "p6-periodo"
          },
          {
            "id": "d",
            "c": 3,
            "r": 0,
            "t": "Aprobar",
            "s": "gerencia",
            "sec": "p6-periodo"
          },
          {
            "id": "e",
            "c": 4,
            "r": 0,
            "t": "Por pagar",
            "s": "al vendedor",
            "sec": "p6-periodo",
            "fin": true
          }
        ],
        "flechas": [
          {
            "de": "a",
            "a": "b"
          },
          {
            "de": "b",
            "a": "c"
          },
          {
            "de": "c",
            "a": "d"
          },
          {
            "de": "d",
            "a": "e"
          }
        ]
      },
      "secciones": [
        {
          "id": "p6-dueno",
          "dueno": true,
          "nombre": "Visión con el dueño",
          "para": "Que el dueño defina cómo se paga la comisión al equipo por las piezas consignadas.",
          "demostrar": [
            {
              "h": "Recorremos con el dueño el mapa del proceso.",
              "d": "Entiende el camino de punta a punta y qué resultado sale al final."
            },
            {
              "h": "Revisamos el plan de comisiones actual.",
              "d": "Refleja cómo quiere pagarle a su equipo."
            }
          ],
          "decidir": [
            "¿La comisión es sobre la venta o sobre lo que gana la tienda?",
            "¿Hay comisión para quien capta la pieza?",
            "En apartados, ¿se paga al liquidar o al primer abono?"
          ],
          "noHace": []
        },
        {
          "id": "p6-plan",
          "nombre": "Plan de comisiones",
          "donde": "Metas y comisiones",
          "para": "El plan paga sobre la venta o sobre el margen; en piezas consignadas el margen es la comisión de la tienda. Opcional: comisión de captación para quien registró la pieza.",
          "demostrar": [
            {
              "h": "Abrimos el plan del equipo de piso.",
              "d": "Muestra su base (venta o margen) y el %."
            }
          ],
          "decidir": [],
          "noHace": []
        },
        {
          "id": "p6-periodo",
          "nombre": "Calcular, aprobar y pagar",
          "pieza": "A",
          "donde": "Metas y comisiones › periodo",
          "para": "El periodo se calcula, se aprueba y se envía a lo que se le debe al vendedor.",
          "demostrar": [
            {
              "h": "Calculamos el periodo actual.",
              "d": "La venta de la pieza A aparece para su vendedor con el monto esperado."
            },
            {
              "h": "Aprobamos y enviamos a pago.",
              "d": "Queda registrado lo que se le debe al vendedor.",
              "o": true
            }
          ],
          "decidir": [],
          "noHace": [
            "El reporte «Desempeño de vendedores» de consignación muestra la comisión en $0; el monto real está en Metas y comisiones."
          ]
        }
      ]
    },
    {
      "id": "p7",
      "nombre": "Si no se vende: vencimiento y retiro",
      "tipos": [
        "Mejora de UI",
        "Mejora de proceso",
        "Condicional / regla",
        "Bug"
      ],
      "resumen": "La pieza C no se vende: aviso, rebaja automática, renovación o devolución a la consignataria.",
      "diagrama": {
        "titulo": "Al vencer, el contrato se renueva solo o sus piezas se devuelven",
        "lectura": "Una revisión automática diaria avisa 7 días antes, aplica la regla de no venta y, al vencer, renueva o marca las piezas para devolver. Al devolver se cobran los servicios que no se pagaron.",
        "nodos": [
          {
            "id": "a",
            "c": 0,
            "r": 0,
            "t": "Pieza C",
            "s": "sin vender",
            "sec": "p7-reglas"
          },
          {
            "id": "b",
            "c": 1,
            "r": 0,
            "t": "Aviso",
            "s": "7 días antes",
            "sec": "p7-reglas"
          },
          {
            "id": "c",
            "c": 2,
            "r": 0,
            "t": "Vencimiento",
            "s": "revisión diaria",
            "sec": "p7-vence"
          },
          {
            "id": "d",
            "c": 3,
            "r": 0,
            "t": "Renovación",
            "s": "automática",
            "sec": "p7-vence",
            "fin": true
          },
          {
            "id": "e",
            "c": 2,
            "r": 1,
            "t": "Por devolver",
            "s": "ya no se vende",
            "sec": "p7-vence"
          },
          {
            "id": "f",
            "c": 3,
            "r": 1,
            "t": "Devolver",
            "s": "y cobrar servicios",
            "sec": "p7-retiro"
          }
        ],
        "flechas": [
          {
            "de": "a",
            "a": "b"
          },
          {
            "de": "b",
            "a": "c"
          },
          {
            "de": "c",
            "a": "d",
            "et": "renueva"
          },
          {
            "de": "c",
            "a": "e",
            "et": "no renueva"
          },
          {
            "de": "e",
            "a": "f"
          }
        ]
      },
      "secciones": [
        {
          "id": "p7-dueno",
          "dueno": true,
          "nombre": "Visión con el dueño",
          "para": "Que el dueño decida qué hacer con las piezas que no se venden.",
          "demostrar": [
            {
              "h": "Recorremos con el dueño el mapa del proceso.",
              "d": "Entiende el camino de punta a punta y qué resultado sale al final."
            },
            {
              "h": "Revisamos las piezas estancadas y los contratos por vencer de la cuenta.",
              "d": "Ve qué hace el sistema solo (aviso, rebaja, renovación) y qué queda por devolver."
            }
          ],
          "decidir": [
            "¿Cuántos días sin venderse hacen estancada una pieza?",
            "¿El texto del correo de vencimiento es el que la tienda quiere enviar?"
          ],
          "noHace": []
        },
        {
          "id": "p7-reglas",
          "nombre": "Aviso y rebaja automática",
          "pieza": "C",
          "donde": "Automático, una vez al día (≈7:20 a.m.); se ve en la pieza y en el Dashboard",
          "para": "Avisa una sola vez, 7 días antes de vencer. Si la pieza no se vende en los días de la plantilla, aplica la regla: rebaja (una sola vez, con el precio anterior tachado) o la marca para devolver.",
          "demostrar": [
            {
              "h": "Abrimos la pieza C en el perfil.",
              "d": "Muestra su contrato y los días que faltan para vencer."
            },
            {
              "h": "Con un contrato de prueba de vigencia corta, revisamos al día siguiente.",
              "d": "Llegó el aviso «por vencer» y se aplicó la regla.",
              "o": true
            }
          ],
          "decidir": [],
          "noHace": [
            "La rebaja automática no le avisa a la consignataria.",
            "Confirmar antes que la revisión diaria esté encendida para la cuenta vendetucloset."
          ]
        },
        {
          "id": "p7-vence",
          "nombre": "Vencimiento y renovación",
          "donde": "Automático; en Clientes, filtro «Con piezas por devolver»",
          "para": "Con renovación automática el contrato se extiende sin nueva firma y se avisa por correo. Sin renovación, queda vencido y sus piezas pasan a «Por devolver».",
          "demostrar": [
            {
              "h": "Buscamos en caja una pieza por devolver.",
              "d": "No se puede vender."
            },
            {
              "h": "Revisamos en Clientes el filtro «Con piezas por devolver».",
              "d": "Aparecen las consignatarias con piezas vencidas.",
              "o": true
            }
          ],
          "decidir": [],
          "noHace": [
            "Una pieza por devolver no se quita sola de la tienda en línea."
          ]
        },
        {
          "id": "p7-retiro",
          "nombre": "Devolver la pieza",
          "pieza": "C",
          "donde": "Perfil › Productos › «Devolver / Retirar»",
          "para": "La pieza sale del inventario. Si tiene servicios sin pagar, se genera el cobro (folio DEV-) a 15 días.",
          "demostrar": [
            {
              "h": "Devolvemos la pieza C.",
              "d": "Queda devuelta y sale del inventario."
            },
            {
              "h": "Revisamos los cobros de la consignataria.",
              "d": "Si C tenía servicios sin pagar, aparece su cobro DEV- correcto."
            },
            {
              "h": "Intentamos devolver una pieza apartada.",
              "d": "No deja y lo explica.",
              "o": true
            }
          ],
          "decidir": [
            "¿Cómo se registra la entrega física (quién recibe y firma)?"
          ],
          "noHace": []
        }
      ]
    },
    {
      "id": "p8",
      "nombre": "Casos especiales",
      "tipos": [
        "Mejora de UI",
        "Mejora de proceso",
        "Condicional / regla",
        "Bug"
      ],
      "resumen": "Lo que pasa poco pero hay que saber resolver: devolución de una pieza ya pagada, pieza no auténtica, incidentes, compra de la pieza por la tienda y robo o pérdida.",
      "secciones": [
        {
          "id": "p8-dueno",
          "dueno": true,
          "nombre": "Visión con el dueño",
          "para": "Que el dueño defina la política y quién atiende cada caso especial.",
          "demostrar": [
            {
              "h": "Repasamos los casos especiales: pieza pagada devuelta, no auténtica, incidentes, compra y robo o pérdida.",
              "d": "Sabe cómo se resuelve cada uno y quién tiene permiso para hacerlo."
            }
          ],
          "decidir": [
            "¿Cuál es la política: se le cobra a la consignataria o la tienda absorbe?",
            "¿Qué se le dice al cliente final y cómo se le reembolsa?",
            "¿Quién atiende y aprueba los incidentes?",
            "¿Quién puede comprarle piezas a la consignataria?"
          ],
          "noHace": []
        },
        {
          "id": "p8-pagada",
          "nombre": "Devolución de una pieza ya pagada",
          "donde": "Perfil › pieza liquidada › «Cliente devolvió»",
          "para": "Si a la consignataria ya se le pagó, la devolución en caja no la revierte sola: con «Cliente devolvió» se recupera el dinero (cobro o descuento de su saldo) y la pieza vuelve a la venta. Fuera de política, la tienda se queda la pieza y no se le cobra.",
          "demostrar": [
            {
              "h": "Mostramos «Cliente devolvió» en una pieza liquidada.",
              "d": "Ofrece recuperar por cobro o descontando del saldo, antes de confirmar.",
              "o": true
            }
          ],
          "decidir": [],
          "noHace": [
            "Si a la consignataria ya se le pagó, la devolución en caja no avisa: hay que hacer «Cliente devolvió» desde su perfil."
          ]
        },
        {
          "id": "p8-noaut",
          "nombre": "Pieza no auténtica después de vendida",
          "donde": "Perfil › pieza vendida › «No auténtica»",
          "para": "Recupera lo pagado a la consignataria con un cobro y bloquea la pieza para siempre.",
          "demostrar": [
            {
              "h": "Mostramos «No auténtica» en una pieza vendida.",
              "d": "Explica el cobro y el bloqueo antes de confirmar.",
              "o": true
            }
          ],
          "decidir": [],
          "noHace": []
        },
        {
          "id": "p8-incidente",
          "nombre": "Incidentes",
          "donde": "Consignación › Incidentes («Reportar incidente», «Cambiar estado», «Resolver»)",
          "para": "Daño, mancha, pérdida, robo o reclamo. Mientras está abierto, la pieza no se vende, no se paga ni se retira. Al resolver con compensación se genera lo que se le debe a la consignataria.",
          "demostrar": [
            {
              "h": "Reportamos un incidente de prueba sobre una pieza disponible y lo resolvemos «sin impacto».",
              "d": "Mientras estuvo abierto, la pieza no se pudo vender.",
              "o": true
            }
          ],
          "decidir": [],
          "noHace": [
            "La consignataria no recibe aviso de los incidentes."
          ]
        },
        {
          "id": "p8-compra",
          "nombre": "Compra por la tienda, robo o pérdida",
          "donde": "Perfil › Productos › «Comprarle la pieza» / «Robo / pérdida» (requiere permiso)",
          "para": "«Comprarle la pieza» le paga valuación − comisión − cargos y la pieza pasa al inventario propio. «Robo / pérdida» le paga como si se hubiera vendido.",
          "demostrar": [
            {
              "h": "Mostramos ambos botones con un usuario con permiso.",
              "d": "Calculan el pago antes de confirmar.",
              "o": true
            }
          ],
          "decidir": [],
          "noHace": []
        }
      ]
    },
    {
      "id": "p9",
      "nombre": "Lo que ve la consignataria (portal)",
      "tipos": [
        "Mejora de UI",
        "Mejora de proceso",
        "Condicional / regla",
        "Bug"
      ],
      "resumen": "Su enlace propio para ver piezas, ventas, pagos y contrato, pedir retiros y actualizar sus datos.",
      "diagrama": {
        "titulo": "La consignataria sigue todo desde su portal",
        "lectura": "Con su enlace ve sus piezas, ventas y pagos. Sus solicitudes de retiro llegan a la bandeja de la tienda y los cambios bancarios esperan aprobación.",
        "nodos": [
          {
            "id": "a",
            "c": 0,
            "r": 0,
            "t": "Enlace",
            "s": "WhatsApp, correo, QR",
            "sec": "p9-portal"
          },
          {
            "id": "b",
            "c": 1,
            "r": 0,
            "t": "Portal",
            "s": "piezas y pagos",
            "sec": "p9-portal",
            "fin": true
          },
          {
            "id": "c",
            "c": 2,
            "r": 0,
            "t": "Retiro",
            "s": "solicitud",
            "sec": "p9-retiro"
          },
          {
            "id": "d",
            "c": 3,
            "r": 0,
            "t": "Bandeja",
            "s": "de la tienda",
            "sec": "p9-retiro"
          },
          {
            "id": "e",
            "c": 2,
            "r": 1,
            "t": "Datos bancarios",
            "s": "cambio",
            "sec": "p9-banco"
          },
          {
            "id": "f",
            "c": 3,
            "r": 1,
            "t": "Aprobación",
            "s": "de la tienda",
            "sec": "p9-banco"
          }
        ],
        "flechas": [
          {
            "de": "a",
            "a": "b"
          },
          {
            "de": "b",
            "a": "c"
          },
          {
            "de": "c",
            "a": "d"
          },
          {
            "de": "b",
            "a": "e",
            "dx": 40
          },
          {
            "de": "e",
            "a": "f"
          }
        ]
      },
      "secciones": [
        {
          "id": "p9-dueno",
          "dueno": true,
          "nombre": "Visión con el dueño",
          "para": "Que el dueño vea lo que verán sus consignatarias y decida qué pueden hacer desde su portal.",
          "demostrar": [
            {
              "h": "Recorremos con el dueño el mapa del proceso.",
              "d": "Entiende el camino de punta a punta y qué resultado sale al final."
            },
            {
              "h": "Abrimos el portal de la consignataria de prueba.",
              "d": "Ve exactamente lo que verá cada consignataria."
            }
          ],
          "decidir": [
            "¿Se le da el portal a todas las consignatarias?",
            "¿Quién atiende los retiros?",
            "¿Se permite cambiar datos bancarios desde el portal?"
          ],
          "noHace": []
        },
        {
          "id": "p9-portal",
          "nombre": "Enlace y portal",
          "pieza": "ABC",
          "donde": "Perfil › «Portal del consignatario» (Generar, WhatsApp, correo, QR, Rotar enlace, Revocar)",
          "para": "Muestra su saldo, lo pagado, lo pendiente, sus productos, servicios, liquidaciones y su contrato con los días restantes.",
          "demostrar": [
            {
              "h": "Generamos el enlace de la consignataria de prueba y lo abrimos en un teléfono.",
              "d": "Ve las piezas A, B y C con su estado y lo que se le pagó."
            },
            {
              "h": "Rotamos el enlace.",
              "d": "El anterior deja de funcionar.",
              "o": true
            }
          ],
          "decidir": [],
          "noHace": []
        },
        {
          "id": "p9-retiro",
          "nombre": "Solicitud de retiro",
          "donde": "Portal › «Solicitar retiro»; tienda: Consignación › Solicitudes de retiro",
          "para": "La solicitud llega a la bandeja de la tienda. Marcarla «Entregada» no devuelve las piezas: se devuelven desde el perfil.",
          "demostrar": [
            {
              "h": "Pedimos un retiro desde el portal.",
              "d": "Aparece en Solicitudes de retiro."
            }
          ],
          "decidir": [],
          "noHace": [
            "La tienda no recibe aviso de una solicitud nueva; hay que revisar la bandeja."
          ]
        },
        {
          "id": "p9-banco",
          "nombre": "Cambio de datos bancarios",
          "donde": "Portal (si está activo); tienda: alerta «Cambios bancarios por aprobar» › perfil",
          "para": "Viene apagado. Si se activa, el cambio queda pendiente hasta que la tienda lo aprueba y se le avisa a la consignataria.",
          "demostrar": [
            {
              "h": "Solicitamos un cambio desde el portal.",
              "d": "Aparece «Cambios bancarios por aprobar» y no se aplica hasta aprobarlo.",
              "o": true
            }
          ],
          "decidir": [],
          "noHace": []
        }
      ]
    },
    {
      "id": "p10",
      "nombre": "Dinámicas: lives y promociones",
      "tipos": [
        "Mejora de UI",
        "Mejora de proceso",
        "Condicional / regla",
        "Bug"
      ],
      "resumen": "Solo si la tienda vende en lives, unboxings o campañas de WhatsApp: agrupar piezas, venderlas y medir cuánto convierte cada dinámica.",
      "secciones": [
        {
          "id": "p10-dueno",
          "dueno": true,
          "nombre": "Visión con el dueño",
          "para": "Solo si la tienda vende en lives o dinámicas: qué se mide y con qué reglas.",
          "demostrar": [
            {
              "h": "Revisamos cómo se mide una dinámica.",
              "d": "Ve piezas vendidas, % de conversión y monto.",
              "o": true
            }
          ],
          "decidir": [
            "¿Qué tipos y canales usa la tienda?",
            "¿Quieren precio especial en la dinámica? (hoy no cambia el precio)"
          ],
          "noHace": []
        },
        {
          "id": "p10-crear",
          "nombre": "Crear la dinámica y asignar piezas",
          "donde": "Consignación › Dinámicas («Lives y dinámicas») › «Nueva dinámica» › «Asignar pieza»",
          "para": "Tipos: live, unboxing, WhatsApp o promoción. Solo admite piezas disponibles o apartadas, sin bloqueo y que no estén en otra dinámica. La dinámica no cambia precio ni comisión.",
          "demostrar": [
            {
              "h": "Creamos una dinámica y le asignamos una pieza disponible.",
              "d": "La pieza queda en la dinámica y la consignataria recibe aviso.",
              "o": true
            },
            {
              "h": "Intentamos asignar una pieza que no está disponible.",
              "d": "No deja y lo explica.",
              "o": true
            }
          ],
          "decidir": [],
          "noHace": []
        },
        {
          "id": "p10-cerrar",
          "nombre": "Vender, finalizar y medir",
          "donde": "Punto de venta normal; Dinámica › «Finalizar» / «Conversión»",
          "para": "La venta corre por el punto de venta normal. Al finalizar, las no vendidas regresan; las estadísticas muestran participantes, vendidas, % de conversión y monto.",
          "demostrar": [
            {
              "h": "Finalizamos la dinámica.",
              "d": "Las piezas no vendidas regresan a disponibles y se ve la conversión.",
              "o": true
            }
          ],
          "decidir": [],
          "noHace": [
            "Cuenta como vendida cualquier pieza vendida mientras siga en la dinámica, sin importar la fecha."
          ]
        }
      ]
    },
    {
      "id": "p11",
      "nombre": "Buscar en SACS: acceso rápido",
      "tipos": [
        "Mejora de UI",
        "Mejora de proceso",
        "Condicional / regla",
        "Bug"
      ],
      "resumen": "La lupa junto al nombre de la cuenta (o Ctrl/⌘ + K) resuelve las consultas del día: se busca, se revisa la vista previa sin abrir nada y el clic lleva directo al detalle.",
      "diagrama": {
        "titulo": "Cada búsqueda se resuelve en la vista previa o con un clic al detalle",
        "lectura": "Se abre con la lupa o Ctrl/⌘ + K, se escribe o se escanea, la vista previa responde sin abrir nada y el clic lleva directo al detalle. Cada usuario solo ve los resultados de los módulos a los que tiene acceso.",
        "nodos": [
          {
            "id": "a",
            "c": 0,
            "r": 0,
            "t": "Abrir",
            "s": "lupa o Ctrl/⌘ + K",
            "sec": "p11-consignataria"
          },
          {
            "id": "b",
            "c": 1,
            "r": 0,
            "t": "Buscar",
            "s": "texto o escáner",
            "sec": "p11-marca"
          },
          {
            "id": "c",
            "c": 2,
            "r": 0,
            "t": "Vista previa",
            "s": "sin abrir nada",
            "sec": "p11-consignataria"
          },
          {
            "id": "d",
            "c": 3,
            "r": 0,
            "t": "Clic",
            "s": "botón o renglón",
            "sec": "p11-permisos"
          },
          {
            "id": "e",
            "c": 4,
            "r": 0,
            "t": "Detalle",
            "s": "resaltado",
            "sec": "p11-permisos",
            "fin": true
          },
          {
            "id": "f",
            "c": 1,
            "r": 1,
            "t": "Filtros",
            "s": "en la frase",
            "sec": "p11-marca"
          },
          {
            "id": "g",
            "c": 3,
            "r": 1,
            "t": "Permisos",
            "s": "por rol",
            "sec": "p11-permisos"
          }
        ],
        "flechas": [
          {
            "de": "a",
            "a": "b"
          },
          {
            "de": "b",
            "a": "c"
          },
          {
            "de": "c",
            "a": "d"
          },
          {
            "de": "d",
            "a": "e"
          },
          {
            "de": "b",
            "a": "f",
            "et": "marca, precio…"
          },
          {
            "de": "d",
            "a": "g",
            "et": "según usuario"
          }
        ]
      },
      "secciones": [
        {
          "id": "p11-dueno",
          "dueno": true,
          "nombre": "Visión con el dueño",
          "para": "Que el dueño vea cómo resolver sus consultas del día en segundos y decida qué ve cada rol.",
          "demostrar": [
            {
              "h": "Recorremos con el dueño el mapa del proceso.",
              "d": "Entiende el camino de punta a punta y qué resultado sale al final."
            },
            {
              "h": "Hacemos las búsquedas que usaría el dueño: una consignataria, «vencido» y «estancadas».",
              "d": "Resuelve sin abrir pantallas y cada clic lleva al detalle."
            }
          ],
          "decidir": [
            "¿Quién paga y si cualquier usuario puede ver esos montos?",
            "¿El cajero debe ver el historial de compras de la clienta?",
            "¿Cuántos días meta tiene cada etapa de preparación?",
            "¿Quién atiende retiros e incidentes, para que solo esa persona vea esos accesos?",
            "¿Qué ve cada rol en el buscador (montos por pagar, datos de contacto, contratos)?"
          ],
          "noHace": []
        },
        {
          "id": "p11-consignataria",
          "nombre": "Encontrar a una consignataria",
          "pieza": "cons",
          "donde": "Buscar en SACS › nombre, teléfono, correo, Instagram o folio CONS-",
          "para": "La vista previa muestra piezas en tienda, vendidas, saldo a favor, lo que se le debe, su próximo pago, su contrato vigente y sus retiros pendientes. Clic → su perfil.",
          "demostrar": [
            {
              "h": "Buscamos a la consignataria de prueba por su nombre y luego por su teléfono.",
              "d": "La encuentra las dos veces."
            },
            {
              "h": "Revisamos la vista previa sin abrir nada.",
              "d": "Muestra sus piezas, ventas, saldo, lo que se le debe, contrato y retiros, igual que su perfil."
            },
            {
              "h": "Damos clic.",
              "d": "Abre su perfil."
            }
          ],
          "decidir": [
            "¿Qué datos necesita ver la tienda en la tarjeta para no tener que abrir el perfil?"
          ],
          "noHace": []
        },
        {
          "id": "p11-codigo",
          "nombre": "Encontrar una pieza por código",
          "pieza": "A",
          "donde": "Buscar en SACS › SKU o código de barras con el lector",
          "para": "El SKU o el código de barras abre la ficha directo, con fotos, precio, comisión, lo que le toca a la consignataria y días a la venta; funciona aunque la pieza ya se haya pagado o devuelto.",
          "demostrar": [
            {
              "h": "Escaneamos la etiqueta de la pieza A (ya vendida).",
              "d": "Abre su ficha con fotos, precio, comisión y lo que le toca a la consignataria."
            },
            {
              "h": "Escaneamos una pieza que está en tienda.",
              "d": "También la abre directo, con sus días a la venta."
            }
          ],
          "decidir": [
            "¿Qué código trae la etiqueta de la tienda? ¿El lector manda Enter al final?"
          ],
          "noHace": []
        },
        {
          "id": "p11-marca",
          "nombre": "Piezas por marca con filtros en la frase",
          "donde": "Buscar en SACS › marca + precio, estado y sucursal en la misma búsqueda",
          "para": "Ejemplos: «gucci menos de 15000 polanco», «chanel entre 10 mil y 20 mil», «vendidas», «apartadas».",
          "demostrar": [
            {
              "h": "Hacemos las 3 búsquedas que más usa el equipo de piso.",
              "d": "Los resultados coinciden con el inventario."
            },
            {
              "h": "Escribimos «vendidas» y luego «apartadas».",
              "d": "Filtra por estado."
            }
          ],
          "decidir": [
            "¿Cuáles son las búsquedas del día a día y cómo llaman a sus sucursales?"
          ],
          "noHace": []
        },
        {
          "id": "p11-deuda",
          "nombre": "Lo que se le debe a las consignatarias",
          "pieza": "A",
          "donde": "Buscar en SACS › «vencido», «por pagar», «esta semana» o folio LIQ-",
          "para": "Muestra montos, vencimiento y pagos hechos. «Ir a pagar» abre esa liquidación en Cuentas por pagar.",
          "demostrar": [
            {
              "h": "Buscamos el folio LIQ- de la pieza A.",
              "d": "Muestra el monto, el vencimiento y el pago hecho."
            },
            {
              "h": "Buscamos «vencido» y damos «Ir a pagar».",
              "d": "Abre esa liquidación en Cuentas por pagar."
            }
          ],
          "decidir": [],
          "noHace": []
        },
        {
          "id": "p11-comprador",
          "nombre": "Cliente comprador y sus apartados",
          "pieza": "B",
          "donde": "Buscar en SACS › nombre o teléfono del cliente comprador",
          "para": "Muestra compras, último ticket y apartados con saldo y vencimiento. Clic en un apartado → ese apartado.",
          "demostrar": [
            {
              "h": "Buscamos a la clienta del apartado de B.",
              "d": "Muestra sus compras, su último ticket y sus apartados."
            },
            {
              "h": "Damos clic en un apartado.",
              "d": "Abre ese apartado."
            }
          ],
          "decidir": [],
          "noHace": []
        },
        {
          "id": "p11-lote",
          "nombre": "Lote y contrato",
          "pieza": "cons",
          "donde": "Buscar en SACS › folio LOTE-",
          "para": "Muestra la consignataria, sus piezas por estado y su contrato (comisión, vence en N días). «Ver contrato» lo abre y el botón de PDF lo descarga.",
          "demostrar": [
            {
              "h": "Buscamos el folio LOTE- del caso de prueba.",
              "d": "Muestra a la consignataria, las piezas A, B y C por estado y su contrato."
            },
            {
              "h": "Damos «Ver contrato» y descargamos el PDF.",
              "d": "Abre el contrato y se descarga."
            }
          ],
          "decidir": [
            "¿El contrato debe salir de aquí o solo del perfil?"
          ],
          "noHace": []
        },
        {
          "id": "p11-preparacion",
          "nombre": "Piezas en preparación",
          "donde": "Buscar en SACS › «por autenticar», «por limpiar», «por fotografiar», «por reparar», «por etiquetar» o «en proceso»",
          "para": "Muestra cuántos días lleva cada pieza y si ya pasó su meta. «Ver en la cola» abre la cola con la pieza resaltada.",
          "demostrar": [
            {
              "h": "Buscamos «por autenticar».",
              "d": "Coincide con la cola de proceso y muestra los días de cada pieza.",
              "o": true
            },
            {
              "h": "Damos «Ver en la cola».",
              "d": "Abre la cola con la pieza resaltada.",
              "o": true
            }
          ],
          "decidir": [],
          "noHace": []
        },
        {
          "id": "p11-estancadas",
          "nombre": "Piezas estancadas",
          "pieza": "C",
          "donde": "Buscar en SACS › «estancadas» o «louis vuitton +60 días»",
          "para": "Muestra las piezas que no se mueven, cuántos días llevan y la acción sugerida (rebajar o devolver).",
          "demostrar": [
            {
              "h": "Buscamos «estancadas».",
              "d": "Muestra las piezas con sus días y la acción sugerida; coincide con lo que el equipo ya identifica."
            },
            {
              "h": "Buscamos una marca con «+60 días».",
              "d": "Combina marca y días.",
              "o": true
            }
          ],
          "decidir": [],
          "noHace": []
        },
        {
          "id": "p11-hoy",
          "nombre": "Lo que hay que atender hoy",
          "pieza": "A",
          "donde": "Buscar en SACS › «retiros», «incidentes», «recuperaciones», «lives», folios DIN-, INC-, REC- o ticket (V-/VEN-)",
          "para": "Muestra el registro con su estado; el clic abre su pantalla con ese registro resaltado.",
          "nota": "Límite conocido: al buscar una venta por ticket, si sus piezas ya se le pagaron a la consignataria solo aparecen las que siguen pendientes.",
          "demostrar": [
            {
              "h": "Buscamos el ticket de la venta de A.",
              "d": "Muestra la venta y sus piezas consignadas."
            },
            {
              "h": "Buscamos «retiros».",
              "d": "Aparece la solicitud del portal con su estado; el clic la abre resaltada."
            }
          ],
          "decidir": [],
          "noHace": []
        },
        {
          "id": "p11-permisos",
          "nombre": "Cada clic lleva al detalle, con los permisos de cada usuario",
          "donde": "Buscar en SACS › con un usuario de caja y con uno administrador",
          "para": "El resultado, sus botones, los renglones de la vista previa, las fotos y «Ver más» abren el detalle; un usuario sin acceso a un módulo no ve ese grupo de resultados.",
          "demostrar": [
            {
              "h": "Repetimos tres búsquedas con el usuario de caja.",
              "d": "Solo ve los grupos de resultados de sus módulos."
            },
            {
              "h": "Repetimos con el usuario administrador.",
              "d": "Ve todo y cada clic abre el detalle."
            }
          ],
          "decidir": [],
          "noHace": []
        }
      ]
    },
    {
      "id": "rep",
      "nombre": "Dashboard y reportes",
      "tipos": [
        "Campo / columna",
        "Dato / cálculo",
        "Filtro",
        "Total / subtotal",
        "Exportación",
        "Reporte nuevo",
        "Bug",
        "Otro"
      ],
      "resumen": "Que el dashboard y los reportes muestren lo que se hizo en la sesión (ventas de A y B, devolución de B, pago de A, retiro de C) y que tengan los datos que la tienda necesita.",
      "secciones": [
        {
          "id": "rep-dueno",
          "dueno": true,
          "nombre": "Visión con el dueño",
          "para": "Que el dueño vea sus números del negocio de consignación y diga qué reportes necesita.",
          "demostrar": [
            {
              "h": "Abrimos el Dashboard de consignación después de la sesión.",
              "d": "Lo vendido, la comisión y lo que se debe a consignatarias reflejan el caso de prueba."
            },
            {
              "h": "Abrimos el reporte «Venta por consignación».",
              "d": "Muestra la pieza A con su venta, lo que le toca a la consignataria y la comisión."
            }
          ],
          "decidir": [
            "¿Qué cifras revisa la dueña cada mañana?",
            "¿Qué reportes llevan hoy fuera del sistema y quién los usa?",
            "¿Necesitan una vista general de lo que se debe a todas las consignatarias (por semana)?",
            "¿Necesitan inventario consignado por consignataria, lote y días en tienda?",
            "¿Necesitan rentabilidad por consignataria o por marca?"
          ],
          "noHace": [
            "Los 10 reportes especiales (rentabilidad, marcas, riesgo, descuentos, tiempos, servicios, flujo de pagos, vendedores, incidencias y retención) están calculados en el sistema pero todavía no tienen pantalla."
          ]
        },
        {
          "id": "rep-dashboard",
          "nombre": "Dashboard de consignación",
          "donde": "Consignación › Dashboard",
          "para": "La foto del negocio: alertas del día, consignatarias activas, valor de inventario, lo vendido, la comisión, lo que se debe a consignatarias, saldo a favor, contratos por vencer y antigüedad del inventario.",
          "demostrar": [
            {
              "h": "Abrimos el Dashboard después de las ventas del caso.",
              "d": "Lo vendido y la comisión incluyen la pieza A."
            },
            {
              "h": "Revisamos «Por pagar a consignatarios».",
              "d": "Coincide con lo que se le debe a la consignataria de prueba."
            },
            {
              "h": "Revisamos las alertas del día.",
              "d": "Son las que la tienda quiere ver; las demás se apagan en Configuración."
            }
          ],
          "decidir": [],
          "noHace": [
            "Lo vendido y la comisión son de todo el histórico: no hay filtro de fechas, sucursal ni consignataria.",
            "No se exporta ni se puede abrir el detalle desde una alerta o una fila."
          ]
        },
        {
          "id": "rep-venta",
          "nombre": "Reporte · Venta por consignación",
          "donde": "Consignación › Reportes (también Reportes › Ventas › Venta por consignación)",
          "para": "Una fila por pieza vendida: cuánto se vendió, cuánto le toca a la consignataria, la comisión y el estado de su pago. Se exporta a Excel.",
          "demostrar": [
            {
              "h": "Filtramos el día de hoy.",
              "d": "Aparece la pieza A con total de venta, lo que le toca a la consignataria y la comisión correctos."
            },
            {
              "h": "Revisamos la fila de TOTALES.",
              "d": "Suma correctamente."
            },
            {
              "h": "Exportamos a Excel.",
              "d": "El archivo trae las ventas del periodo."
            }
          ],
          "decidir": [
            "¿Qué columnas necesita la tienda a la vista (fecha de venta, SKU, vendedor, folio de pago)?"
          ],
          "noHace": [
            "El rango de fechas es de máximo 40 días.",
            "Algunas columnas (Usuario, Almacén, Caja) y algunos filtros todavía no traen dato; revisarlo antes de mostrarlo.",
            "El panel de detalle de la pieza muestra datos de ejemplo en «Días en consigna», historial de precios y actividad.",
            "El Excel solo respeta fechas y estado, no los demás filtros."
          ]
        },
        {
          "id": "rep-utilidad",
          "nombre": "Utilidad de ventas y de cobros",
          "donde": "Reportes › Comparativo de ventas y Comparativo de cobros (sección de consignación)",
          "para": "Cuánto gana realmente la tienda con lo vendido y qué parte de lo cobrado es de las consignatarias. Se agrupan por mes, día, sucursal, vendedor, consignataria, categoría o marca; se exportan a CSV.",
          "demostrar": [
            {
              "h": "Abrimos «Utilidad real de las ventas» con el día de hoy.",
              "d": "La utilidad coincide con la comisión de la pieza A."
            },
            {
              "h": "Abrimos «De lo cobrado, ¿cuánto es de las consignatarias?».",
              "d": "La parte de la consignataria coincide con lo que se le debe.",
              "o": true
            }
          ],
          "decidir": [],
          "noHace": []
        }
      ]
    }
  ]
};
