// Error de negocio con status HTTP y código estable para el cliente.
export class AppError extends Error {
  status: number; code: string; details?: unknown;
  constructor(status: number, code: string, message?: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}
export const badRequest = (code: string, msg?: string, details?: unknown) => new AppError(400, code, msg, details);
export const unauthorized = (code: string, msg?: string) => new AppError(401, code, msg);
export const forbidden = (code: string, msg?: string) => new AppError(403, code, msg);
export const notFound = (msg: string = 'Recurso no encontrado') => new AppError(404, 'NOT_FOUND', msg);
export const conflict = (code: string, msg?: string) => new AppError(409, code, msg);
