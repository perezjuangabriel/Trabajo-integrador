// Validaciones de formulario en el cliente (el servidor siempre vuelve a validar).
export const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
export const passwordProblem = (v: string): string | null =>
  v.length < 8 ? 'Mínimo 8 caracteres' : !/[A-Za-z]/.test(v) || !/\d/.test(v) ? 'Debe incluir letras y números' : null;
export const isCode = (v: string) => /^\d{6}$/.test(v.trim());
export const isUrl = (v: string) => { try { const u = new URL(v.trim()); return u.protocol === 'http:' || u.protocol === 'https:'; } catch { return false; } };
export const toNumber = (v: string): number | null => { const n = Number(v.replace(',', '.')); return v.trim() !== '' && Number.isFinite(n) ? n : null; };
