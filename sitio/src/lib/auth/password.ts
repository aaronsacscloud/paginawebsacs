// Password hashing with bcryptjs.
// Cost factor 10 = ~100ms en producción, suficiente seguridad sin friction perceptible.

import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;
const MIN_LENGTH = 8;

export function isValidPassword(password: string): { ok: boolean; reason?: string } {
  if (!password || password.length < MIN_LENGTH) {
    return { ok: false, reason: `Mínimo ${MIN_LENGTH} caracteres` };
  }
  if (password.length > 200) {
    return { ok: false, reason: 'Máximo 200 caracteres' };
  }
  return { ok: true };
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  if (!hash) return false;
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
}
