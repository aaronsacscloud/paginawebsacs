// Motivos de rechazo, en palabras.
//
// Viven aquí y no en cada pantalla porque los usan la UI de campañas, el
// tablero de alcance y el reporte de salud. Tres copias del mismo diccionario
// terminan diciendo tres cosas distintas del mismo código.
export const MOTIVO_TEXTO: Record<string, string> = {
  suprimido: 'Se dio de baja o rebotó',
  presion: 'Ya recibió el máximo de la semana',
  presion_empresa: 'Otro contacto de su empresa ya lo recibió',
  role_account: 'Buzón de función (info@, ventas@…)',
  email_invalido: 'El correo no es válido',
  limite_diario: 'Se alcanzó el límite del día',
  sin_configurar: 'Falta configuración de correo',
  error_proveedor: 'El proveedor rechazó el envío',
  'campaña cancelada': 'La campaña se canceló',
};

/** ¿Esta persona se puede alcanzar otro día, o está perdida? */
export const ES_RECUPERABLE = (motivo: string): boolean =>
  ['presion', 'presion_empresa', 'limite_diario'].includes(motivo);
