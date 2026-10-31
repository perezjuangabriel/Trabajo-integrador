import { ZodError } from 'zod';

// validate({ body, query, params }) -> deja los datos ya validados/normalizados en req.valid.
// (En Express 5 req.query es de solo lectura, por eso no se reescribe req.*.)
export const validate = (schemas) => (req, res, next) => {
  const valid = {};
  for (const part of ['body', 'query', 'params']) {
    if (!schemas[part]) continue;
    const result = schemas[part].safeParse(req[part] ?? {});
    if (!result.success) throw new ZodError(result.error.issues);
    valid[part] = result.data;
  }
  req.valid = valid;
  next();
};
