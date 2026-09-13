// Con cuánto se saluda. Es una prueba pequeña para algo que se ve en el primer
// renglón de cada correo frío: equivocarse aquí es saludar a un desconocido por
// su apellido, o llamarle Juan a Juan Carlos.
import { describe, it, expect } from 'vitest';
import { nombrePila } from './nombre';

describe('nombrePila', () => {
  it('corta el apellido', () => {
    expect(nombrePila('Cielo Inzunza')).toBe('Cielo');
    expect(nombrePila('Gerardo Dunand Spitalier')).toBe('Gerardo');
    expect(nombrePila('Adriana Madrid')).toBe('Adriana');
  });

  it('respeta el nombre compuesto: a Juan Carlos nadie le dice Juan', () => {
    expect(nombrePila('Juan Carlos Medina Fernández')).toBe('Juan Carlos');
    expect(nombrePila('José Luis Zaga')).toBe('José Luis');
    expect(nombrePila('Luz María Robles')).toBe('Luz María');
  });

  it('arma los que llevan partícula', () => {
    expect(nombrePila('María del Carmen Solís')).toBe('María del Carmen');
    expect(nombrePila('Ana de la Luz Pérez')).toBe('Ana de la Luz');
  });

  it('quita el tratamiento, que no es el nombre', () => {
    expect(nombrePila('Don Pepe Castro')).toBe('Pepe');
    expect(nombrePila('Lic. Marcela Ruiz')).toBe('Marcela');
    expect(nombrePila('Ing Juan Carlos Medina')).toBe('Juan Carlos');
  });

  it('desabrevia Ma.', () => {
    expect(nombrePila('Ma. Guadalupe Ríos')).toBe('María Guadalupe');
  });

  it('sin nombre devuelve vacío, para que el saludo se borre entero', () => {
    expect(nombrePila('')).toBe('');
    expect(nombrePila(null)).toBe('');
    expect(nombrePila('   ')).toBe('');
  });
});
