// Error de negocio con status HTTP y código estable para el cliente.
export class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}
export const badRequest = (code, msg, details) => new AppError(400, code, msg, details);
export const unauthorized = (code, msg) => new AppError(401, code, msg);
export const forbidden = (code, msg) => new AppError(403, code, msg);
export const notFound = (msg = 'Recurso no encontrado') => new AppError(404, 'NOT_FOUND', msg);
export const conflict = (code, msg) => new AppError(409, code, msg);
