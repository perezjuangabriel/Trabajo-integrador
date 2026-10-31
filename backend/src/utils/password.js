import bcrypt from 'bcryptjs';
import { env } from '../config/env.js';

export const hashPassword = (plain) => bcrypt.hash(plain, env.BCRYPT_COST);
export const verifyPassword = (plain, hash) => bcrypt.compare(plain, hash);

// Hash de relleno: se compara igual cuando el usuario no existe, para que el
// tiempo de respuesta no revele qué correos están registrados.
const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', env.BCRYPT_COST);
export const burnPasswordCheck = (plain) => bcrypt.compare(plain, DUMMY_HASH);
