import { env } from '../config/env.js';
import * as oauth from '../services/oauth.service.js';
import { getAdapter } from '../services/oauthProviders.js';
import { AppError, badRequest } from '../utils/AppError.js';

const resolveAppRedirect = (requested) => {
  const target = requested ?? env.OAUTH_APP_REDIRECTS[0];
  // Lista blanca: evita que el servidor redirija el código a una app o sitio arbitrario.
  if (!target || !oauth.allowedAppRedirect(target)) throw badRequest('INVALID_APP_REDIRECT', 'app_redirect no permitido');
  return target;
};
const backToApp = (res, appRedirect, params) => {
  const url = new URL(appRedirect);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  res.redirect(302, url.toString());
};

/** 1) La app abre esta URL en el navegador del sistema. */
export function start(req, res) {
  const { provider } = req.valid.params;
  oauth.assertConfigured(provider);
  const appRedirect = resolveAppRedirect(req.valid.query.app_redirect);
  res.redirect(302, oauth.buildAuthorizeUrl(provider, { cc: req.valid.query.code_challenge, ar: appRedirect }));
}

/** Vincular otro proveedor a la cuenta con sesión: devuelve la URL a abrir en el navegador. */
export function linkStart(req, res) {
  const { provider } = req.valid.params;
  oauth.assertConfigured(provider);
  const appRedirect = resolveAppRedirect(req.valid.body.appRedirect);
  res.json({ data: { url: oauth.buildAuthorizeUrl(provider, { ar: appRedirect, link: req.user.id }) } });
}

/** 2) El proveedor vuelve aquí. Siempre termina redirigiendo a la app (con ?code=, ?linked= o ?error=). */
export async function callback(req, res) {
  const { provider } = req.valid.params;
  const { code, state, error } = req.valid.query;
  const st = oauth.verifyState(state, provider); // si el state es inválido no hay a dónde volver: responde 400
  const appRedirect = oauth.allowedAppRedirect(st.ar) ? st.ar : null;
  if (!appRedirect) throw badRequest('INVALID_APP_REDIRECT', 'app_redirect no permitido');

  try {
    if (error || !code) throw badRequest('ACCESS_DENIED', 'El usuario canceló o el proveedor rechazó el acceso');
    const profile = await getAdapter(provider).fetchProfile(code);
    if (st.link) {
      await oauth.linkToUser(st.link, provider, profile);
      return backToApp(res, appRedirect, { linked: provider });
    }
    const user = await oauth.resolveLogin(provider, profile);
    return backToApp(res, appRedirect, { code: await oauth.createExchangeCode(user.id, st.cc) });
  } catch (err) {
    if (!(err instanceof AppError)) console.error('[oauth callback]', err);
    return backToApp(res, appRedirect, { error: err instanceof AppError ? err.code : 'SERVER_ERROR' });
  }
}

/** 3) La app canjea el código de un solo uso (+ verifier PKCE) por la sesión. */
export const exchange = async (req, res) =>
  res.json({ data: await oauth.exchange(req.valid.body, { userAgent: req.get('user-agent') }) });

export const unlink = async (req, res) => {
  await oauth.unlink(req.user, req.valid.params.provider);
  res.status(204).end();
};
