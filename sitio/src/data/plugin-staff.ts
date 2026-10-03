/**
 * /plugins/staff — «Staff», el plugin de Sacs para el equipo de la tienda (3-oct-2026).
 *
 * Pedido del dueño: una sección de plugins en el sitio, empezando por Staff, «súper visual, con todo lo que incluye:
 * el expediente del empleado, el reloj checador con sus diferentes formas, que el colaborador tenga su kardex, pueda
 * checar y ver sus resultados, que puedan cambiar horarios, análisis de horarios, vacaciones… con fotos grandes,
 * explicaciones claras y pantallas reales de Sacs con la información de dibujotecnico, que ya lo usa».
 *
 * LO QUE EXISTE (revisado en sacs_api, sacs3 y SACSMobile el 3-oct-2026) y es lo que la página cuenta:
 *  - Expediente (sacs3 lista-empleados): pestañas Resumen · Datos · Documentos · Vacaciones · Kardex · Ciclo; checklist
 *    de ingreso y de salida, resguardos, contrato (PDF, Word, firmado), traslado, baja y recontratación. Los datos
 *    sensibles (CURP, RFC, NSS, INE, bancarios y salario) solo con permiso.
 *  - Reloj checador: botón simple, geocerca (GPS por sucursal) y kiosco con PIN («Teclea tu PIN · El mismo que usas en
 *    el punto de venta»); 4 marcajes al día con la hora del servidor, sin doble marcaje; estados A tiempo · Llegaste
 *    antes · Con retardo · Retardo grave · Comida excedida · Salida anticipada; home office. (El modo selfie existe en
 *    la configuración pero ninguna app toma la foto: NO se anuncia.)
 *  - La app del colaborador (SACSMobile «Mi Asistencia» y «Mi Equipo»): días de vacaciones y económicos, su
 *    puntualidad, marcar, su historial, sus turnos y cambios de turno, justificantes con evidencia, solicitudes, su
 *    contrato con firma digital, encuestas NOM-035, comunicados, premios, sus actas, el directorio y el organigrama.
 *  - Horarios: plantillas, horario base, cuadrante por semana/quincena/mes, copiar semana, prellenar desde horarios
 *    base, reglas (mínimo de personas por día, descanso entre turnos, tope de horas extra), avisos de la LFT,
 *    cobertura por día, incidencias e historial; cambios de turno entre compañeros con aprobación.
 *  - Vacaciones y permisos: tabla LFT 2023 automática (12 → 32 días), días económicos, flujos de aprobación por tipo,
 *    avisos en la campana. Tipos: vacaciones, permiso con y sin goce, incapacidad, día económico, tiempo extra, día de
 *    descanso, día festivo y home office.
 *  - Actas administrativas: testigos (mínimo 2), aprobación según gravedad, firma de enterado o negativa, PDF con QR.
 *  - Premios (5 tipos con puntos), ranking de puntualidad, prenómina (CSV) y el Dashboard de RH con riesgo legal.
 *  - IA: en el código no hay IA dentro de Staff (lo automático son reglas). El bloque de AXO va por pedido del dueño
 *    («todo automatizado con IA»); se le avisó que hoy AXO no consulta los datos del equipo.
 * Pantallas: recortes reales de la cuenta dibujotecnico (3-oct-2026). Los nombres ya se habían autorizado para la
 * presentación de Staff (lista y organigrama); en los registros personales el nombre va difuminado y el dato visible:
 * solicitudes, justificantes, ranking de puntualidad, entradas del día, expediente (encabezado y archivos), prenómina y
 * contratos por vencer. Fuera del todo: salario, CURP/RFC/NSS, domicilios, teléfonos y actas. Fotos: gpt-image-2.5.
 */

const I = '/images/plugins/staff/';

export const STAFF = {
  folio: 'Plugin · Staff',
  etiqueta: 'Para tu equipo',
  titulo: 'Tu equipo, en orden.',
  bajada: 'Checan desde su celular o en el kiosco de la tienda, ven sus turnos, piden vacaciones y firman su contrato. Tú tienes el expediente, el cuadrante, la prenómina y lo que pide la ley, en un solo lugar.',
};

// «Todo lo que incluye»: el mapa del plugin (cada pieza lleva a su sección).
export const INCLUYE = [
  { id: 'staff-checador', t: 'Reloj checador', d: 'Desde su celular con GPS o en el kiosco con su PIN.', img: `${I}tel-estado.webp`, w: 780, h: 580, tono: 'negro', ancha: true },
  { id: 'staff-app', t: 'La app del colaborador', d: 'Su historial, sus turnos, sus vacaciones y su contrato.', img: `${I}tel-checa.webp`, w: 780, h: 1688, tono: 'fucsia', alto: true },
  { id: 'staff-expediente', t: 'Expediente digital', d: 'Datos, documentos, kardex y checklist de ingreso.', img: `${I}exp-resumen.webp`, w: 1120, h: 696, tono: 'marfil' },
  { id: 'staff-horarios', t: 'Horarios y cuadrante', d: 'La semana de cada tienda, con las reglas de la ley.', img: `${I}cuadrante-reglas.webp`, w: 868, h: 864, tono: 'marino' },
  { id: 'staff-vacaciones', t: 'Vacaciones y permisos', d: 'Saldos por la LFT 2023 y aprobación en un toque.', img: `${I}exp-vacaciones.webp`, w: 1120, h: 852, tono: 'azul' },
  { id: 'staff-actas', t: 'Actas administrativas', d: 'Con testigos, firma y PDF con QR.', tono: 'negro', icono: 'acta' },
  { id: 'staff-premios', t: 'Premios y puntualidad', d: 'El ranking del mes y premios con puntos.', img: `${I}control-ranking.webp`, w: 952, h: 596, tono: 'fucsia', ancha: true },
  { id: 'staff-nomina', t: 'Prenómina y riesgo legal', d: 'Las incidencias del periodo, listas para tu nómina.', img: `${I}prenomina.webp`, w: 2192, h: 1532, tono: 'marfil', ancha: true },
];

// «Así empieza tu día»: el Dashboard de Empleados.
export const DIA = {
  k: 'Dashboard de RH',
  h: 'Abres Sacs y ya sabes qué hacer.',
  p: 'Lo que te está esperando, quién ya llegó y lo que te puede costar dinero, en la primera pantalla del día.',
  notas: [
    { n: '01', t: 'Te están esperando', d: 'Solicitudes por aprobar y justificantes por revisar. En rojo, la que lleva más tiempo esperando.' },
    { n: '02', t: 'Cómo va el día', d: 'Cuántos ya marcaron, cuántos a tiempo y cuántos con retardo.' },
    { n: '03', t: 'Esto puede costar dinero', d: 'Contratos por vencer y documentos vencidos, antes de que lleguen a una inspección.' },
  ],
};

// El reloj checador, un paso por tramo del scroll.
export const CHECADOR = {
  k: 'Reloj checador',
  h: 'Checa como le quede mejor a tu tienda.',
  tramos: [
    { n: '01', t: 'Desde su celular, con GPS', d: 'Llega, abre Sacs y marca. La ubicación confirma que está en su sucursal; si no, no marca.' },
    { n: '02', t: 'En el kiosco, con su PIN', d: 'Una tablet en la entrada de personal. Teclea el mismo PIN que usa en el punto de venta y listo: la fila avanza sola.' },
    { n: '03', t: 'Cuatro marcajes, con su estado', d: 'Entrada, salida a comida, regreso y salida. La hora la pone el servidor, no el celular, y nadie marca dos veces lo mismo.' },
  ],
  marcajes: ['Entrada', 'Salida a comida', 'Regreso de comida', 'Salida'],
  estados: [
    { t: 'A tiempo', c: 'ok' }, { t: 'Llegaste antes', c: 'ok' }, { t: 'Con retardo', c: 'warn' }, { t: 'Retardo grave', c: 'bad' },
    { t: 'Comida excedida', c: 'warn' }, { t: 'Salida anticipada', c: 'warn' }, { t: 'Descanso trabajado', c: 'mute' },
  ],
  extra: ['Tolerancias por cuenta: retardo y retardo grave', 'Geocerca por sucursal, con su radio en metros', 'Home office sin geocerca, con su ubicación guardada'],
};

// La app del colaborador (SACSMobile): una pantalla real por tarjeta.
export const APP = {
  k: 'La app del colaborador',
  h: 'Su Sacs, en su celular.',
  p: 'Cada persona de tu equipo tiene su propia app: checa, ve sus resultados y resuelve lo suyo sin pasar por la oficina.',
  pantallas: [
    { img: 'tel-checa', t: 'Checa al llegar', d: 'Su estado del día, su puntualidad y sus días de vacaciones, a la vista.' },
    { img: 'tel-historial', t: 'Ve su historial', d: 'Cada entrada, comida y salida, día por día, con su hora.' },
    { img: 'tel-turnos', t: 'Cambia su turno', d: 'Pide cambiar un día o intercambia con un compañero, y justifica un retardo con evidencia.' },
    { img: 'tel-vacaciones', t: 'Pide sus vacaciones', d: 'Ve su saldo y sigue cada solicitud hasta que se aprueba.' },
    { img: 'tel-contrato', t: 'Firma su contrato', d: 'Lo lee, lo firma en digital y responde las encuestas NOM-035, que son anónimas.' },
    { img: 'tel-organigrama', t: 'Conoce a su equipo', d: 'El directorio y el organigrama de toda la empresa.' },
  ],
};

// El expediente: pestañas reales (cada una con su captura).
export const EXPEDIENTE = {
  k: 'Expediente digital',
  h: 'Todo de cada persona, en un solo lugar.',
  p: 'Tu plantilla completa, por sucursal y por estado, con su antigüedad y su saldo de vacaciones. Abres a cualquiera y está todo.',
  pestanas: [
    { id: 'resumen', t: 'Resumen', img: 'exp-resumen', w: 1120, h: 696, d: 'Antigüedad, vacaciones disponibles, días económicos y documentos, de un vistazo.' },
    { id: 'documentos', t: 'Documentos', img: 'exp-documentos', w: 1120, h: 1052, d: 'Sube INE, CURP, comprobantes y contratos. Sacs te dice qué le falta a cada expediente.' },
    { id: 'vacaciones', t: 'Vacaciones', img: 'exp-vacaciones', w: 1120, h: 852, d: 'Los días que le corresponden por ley, los que ya usó y su saldo, calculados solos.' },
    { id: 'kardex', t: 'Kardex', img: 'exp-kardex', w: 1120, h: 1064, d: 'Cada movimiento queda registrado: altas, cambios de horario, documentos y ediciones, con quién y cuándo.' },
    { id: 'ciclo', t: 'Ciclo', img: 'exp-ciclo', w: 1120, h: 1632, d: 'El checklist de ingreso (contrato, IMSS, uniforme, llaves, capacitación), el de salida, los resguardos y el contrato en PDF o Word.' },
  ],
  privado: 'Los datos sensibles (CURP, RFC, NSS, INE, bancarios y salario) solo los ve quien tiene permiso.',
  acciones: ['Nuevo empleado', 'Trasladar de sucursal', 'Dar de baja', 'Recontratar', 'Organigrama', 'Exportar a Excel'],
};

// Horarios: el cuadrante real (los turnos de la cuenta) y un ejemplo de la semana.
export const HORARIOS = {
  k: 'Horarios y cuadrante',
  h: 'La semana de cada tienda, sin hojas de cálculo.',
  p: 'Arma los turnos de la semana arrastrándolos, cópialos de la semana anterior o prellénalos desde el horario base de cada quien.',
  puntos: [
    { t: 'Plantillas y horario base', d: 'Cada turno con su hora de comida, y horarios distintos por día.' },
    { t: 'Reglas de la tienda', d: 'Mínimo de personas por día, descanso entre turnos y tope de horas extra.' },
    { t: 'Avisos de la ley', d: 'Te avisa antes de publicar la semana: sin día de descanso, horas de más, extra fuera de tope.' },
    { t: 'Cambios entre compañeros', d: 'Uno pide, el otro acepta y tú apruebas. Todo queda en el historial.' },
  ],
  // ejemplo de la semana (nombres de ejemplo; la cuenta real aún no publica su cuadrante)
  semana: {
    dias: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'],
    filas: [
      { n: 'Ana Ruiz', p: 'Encargada', t: ['A', 'A', 'A', 'A', 'A', '—', 'C'], h: '46 h' },
      { n: 'Luis Ortega', p: 'Vendedor de piso', t: ['C', 'C', '—', 'C', 'C', 'C', 'A'], h: '48 h' },
      { n: 'Sofía Méndez', p: 'Cajera', t: ['A', '—', 'A', 'A', 'C', 'C', 'C'], h: '48 h' },
      { n: 'Diego Paredes', p: 'Vendedor de piso', t: ['C', 'C', 'C', 'C', 'C', 'C', 'C'], h: '56 h', aviso: 'Sin día de descanso en la semana (LFT art. 69).' },
    ],
    turnos: { A: 'Apertura · 09:00–17:00', C: 'Cierre · 13:00–21:00' },
  },
};

// Vacaciones por la LFT (reforma 2023): años de servicio → días.
export const VACACIONES = {
  k: 'Vacaciones y permisos',
  h: 'Vacaciones por ley, sin Excel.',
  p: 'Sacs calcula los días que le tocan a cada quien por su antigüedad, con la tabla de la Ley Federal del Trabajo de 2023. Tú solo apruebas.',
  tabla: [
    { a: '1', d: 12 }, { a: '2', d: 14 }, { a: '3', d: 16 }, { a: '4', d: 18 }, { a: '5', d: 20 },
    { a: '6–10', d: 22 }, { a: '11–15', d: 24 }, { a: '16–20', d: 26 }, { a: '21–25', d: 28 }, { a: '26–30', d: 30 }, { a: '31–35', d: 32 },
  ],
  pasos: [
    { n: '01', t: 'La pide desde su celular', d: 'Elige las fechas y ve cuántos días le quedan.' },
    { n: '02', t: 'Le llega a quien aprueba', d: 'Su jefe directo, o la cadena que tú definas por tipo de solicitud.' },
    { n: '03', t: 'El saldo se descuenta solo', d: 'Y a la persona le llega el aviso de que se aprobó.' },
  ],
  tipos: ['Vacaciones', 'Permiso con goce', 'Permiso sin goce', 'Incapacidad', 'Día económico', 'Tiempo extra', 'Día de descanso', 'Día festivo', 'Home office'],
};

// Actas administrativas: el flujo real.
export const ACTAS = {
  k: 'Actas administrativas',
  h: 'Actas que se sostienen.',
  p: 'Cuando hay que levantar un acta, Sacs lleva el proceso completo y deja el documento listo, con su folio y su QR.',
  pasos: [
    { n: '01', t: 'Se levanta el acta', d: 'Con su categoría, los hechos y el artículo de la LFT que aplica.' },
    { n: '02', t: 'Firman dos testigos', d: 'Desde su propia app; sin dos firmas no avanza.' },
    { n: '03', t: 'Se aprueba según la gravedad', d: 'Leve: el supervisor. Media: también RH. Grave: también gerencia.' },
    { n: '04', t: 'El colaborador responde', d: 'La firma de enterado o se registra que no quiso firmar. También da su versión.' },
    { n: '05', t: 'Queda el PDF con QR', d: 'Con el folio, las firmas y la fecha, guardado en su expediente.' },
  ],
};

// Premios y puntualidad.
export const PREMIOS = {
  k: 'Puntualidad que se premia',
  h: 'Quien llega a tiempo, se nota.',
  p: 'El ranking de puntualidad de los últimos 30 días, por persona, y premios con puntos que quedan en su expediente y en su app.',
  premios: [
    { t: 'Puntualidad perfecta', p: 100 }, { t: 'Mejor asistencia', p: 150 }, { t: 'Sin faltas', p: 80 },
    { t: 'Empleado del mes', p: 200 }, { t: 'Reconocimiento', p: 50 },
  ],
};

// Prenómina y lo que pide la ley.
export const NOMINA = {
  k: 'Prenómina y riesgo legal',
  h: 'Tu nómina, sin armarla a mano.',
  p: 'Eliges el periodo y Sacs junta por persona los días, retardos, faltas, justificantes, comidas excedidas, horas extra planeadas y reales, vacaciones e incapacidades. La descargas en CSV para tu nómina.',
  ley: {
    k: 'Registro electrónico de jornada',
    h: 'Desde el 1 de enero de 2027 es obligatorio.',
    p: 'La reforma del 1 de mayo de 2026 añadió la fracción XXXIV al artículo 132 de la Ley Federal del Trabajo: hora de inicio y de término de cada trabajador, conservada e inalterable. Se admite marcaje web, kiosco o app móvil con geolocalización: justo lo que hace Staff.',
    multa: '$29,327 – $586,550',
    multaD: 'por cada trabajador afectado (art. 994 fr. IV Bis: 250 a 5,000 UMA de 2026). La reincidencia la duplica.',
    nota: 'Información general, no es asesoría legal. El cumplimiento es responsabilidad del patrón.',
  },
};

// En automático (y AXO).
export const AUTO = {
  k: 'En automático',
  h: 'Lo que antes hacías a mano, ya no.',
  items: [
    { t: 'Los saldos de vacaciones', d: 'Por antigüedad, con la tabla de la ley.' },
    { t: 'El estado de cada marcaje', d: 'A tiempo, retardo o retardo grave, con tus tolerancias.' },
    { t: 'Los avisos de la ley', d: 'En el cuadrante, antes de publicar la semana.' },
    { t: 'Los contratos por vencer', d: 'Y los documentos vencidos, en el Dashboard de RH.' },
    { t: 'Las aprobaciones', d: 'Cada solicitud le llega a quien debe aprobarla.' },
    { t: 'La semana prellenada', d: 'Desde el horario base de cada quien, con un clic.' },
  ],
  axo: {
    k: 'Con AXO',
    h: 'Pregúntale por tu equipo.',
    chat: [
      { q: '¿Quién no ha marcado hoy en Polanco?', a: 'Faltan 2 de 6: Luis Ortega (entra a las 13:00) y Sofía Méndez, que tiene vacaciones aprobadas hoy.' },
      { q: '¿A quién se le vence el contrato este mes?', a: 'A 3 personas. La más próxima vence en 6 días: ¿te preparo la renovación?' },
    ],
  },
};

export const RESUELVE = {
  folio: ['Lo que resuelve', 'Para tu equipo'] as [string, string],
  titulo: 'Lo que deja de pasar.',
  puntos: [
    'La lista de asistencia en papel que nadie revisa.',
    'Las vacaciones en un Excel que no cuadra con la ley.',
    'Los cambios de turno por WhatsApp que nadie aprueba.',
    'El contrato sin firmar y el expediente incompleto.',
    'La prenómina armada a mano cada quincena.',
  ],
};

export const PREGUNTAS_STAFF = [
  { question: '¿Qué necesito para empezar?', answer: 'Que cada persona de tu equipo tenga su usuario en Sacs (o «solo asistencia», si no usa el sistema). Con eso ya checa desde la app; si prefieres kiosco, basta una tablet en la entrada de personal con el link del checador.' },
  { question: '¿Cómo se evita que alguien cheque desde su casa?', answer: 'Con la geocerca: cada sucursal tiene su ubicación y su radio en metros, y fuera de ese radio no se puede marcar. En el kiosco, cada quien marca con su PIN. La hora siempre la pone el servidor, no el celular.' },
  { question: '¿Calcula la nómina?', answer: 'Staff arma la prenómina del periodo por persona (días, retardos, faltas, justificantes, horas extra, vacaciones e incapacidades) y la descargas en CSV para tu nómina. El cálculo y el timbrado de la nómina son aparte.' },
  { question: '¿Las vacaciones se calculan solas?', answer: 'Sí. Con la antigüedad de cada persona y la tabla de la reforma 2023 de la Ley Federal del Trabajo (12 días el primer año, hasta 32). Puedes ajustar la tabla para tu empresa y permitir vacaciones anticipadas.' },
  { question: '¿Quién ve los salarios y los datos personales?', answer: 'Solo quien tenga el permiso. CURP, RFC, NSS, INE, datos bancarios y salario quedan ocultos para el resto, aunque vean el expediente.' },
  { question: '¿Sirve para el registro electrónico de jornada de 2027?', answer: 'Staff registra la hora de inicio y de término de cada persona con la hora del servidor, desde la app con geolocalización o desde el kiosco, y conserva el historial para exhibirlo. Es información general: el cumplimiento es responsabilidad del patrón.' },
  { question: '¿Cuánto cuesta?', answer: 'Se cobra por empleado al mes, con pago anual. En la demo te damos el precio para el tamaño de tu equipo.' },
];
