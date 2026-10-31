import { Resend } from 'resend';
import { env } from '../config/env.js';

// Transporte intercambiable: en pruebas se reemplaza por uno que captura los mensajes.
let transport = null;
export const setMailTransport = (t) => { transport = t; };

async function resendTransport({ to, subject, html, text }) {
  if (!env.RESEND_API_KEY) {
    // Sin API key NO se simula un envío exitoso: se avisa claramente en el log del servidor.
    console.warn(`[mail] RESEND_API_KEY no configurada. Correo NO enviado a ${to}: "${subject}"`);
    if (env.NODE_ENV === 'development') console.warn(`[mail][DEV] contenido:\n${text}`);
    return { sent: false };
  }
  const client = new Resend(env.RESEND_API_KEY);
  const { error } = await client.emails.send({ from: env.MAIL_FROM, to, subject, html, text });
  if (error) {
    console.error('[mail] Resend devolvió un error:', error);
    return { sent: false };
  }
  return { sent: true };
}

export async function sendMail(msg) {
  try {
    return await (transport ?? resendTransport)(msg);
  } catch (err) {
    console.error('[mail] fallo de envío:', err.message);
    return { sent: false };
  }
}

const wrap = (title, body) => `<div style="font-family:sans-serif;max-width:480px"><h2>${title}</h2>${body}<p style="color:#888;font-size:12px">SPOTCHECK</p></div>`;
const codeBlock = (code) => `<p style="font-size:32px;letter-spacing:6px;font-weight:700">${code}</p>`;

export const sendVerificationEmail = (to, code) =>
  sendMail({
    to, subject: 'Verificá tu correo en SPOTCHECK',
    text: `Tu código de verificación es ${code}. Vence en ${env.CODE_TTL_MIN} minutos.`,
    html: wrap('Verificá tu correo', `<p>Ingresá este código en la app:</p>${codeBlock(code)}<p>Vence en ${env.CODE_TTL_MIN} minutos.</p>`),
  });
export const sendPasswordResetEmail = (to, code) =>
  sendMail({
    to, subject: 'Recuperar contraseña de SPOTCHECK',
    text: `Tu código para restablecer la contraseña es ${code}. Vence en ${env.CODE_TTL_MIN} minutos. Si no lo pediste, ignorá este correo.`,
    html: wrap('Restablecer contraseña', `<p>Tu código:</p>${codeBlock(code)}<p>Vence en ${env.CODE_TTL_MIN} minutos. Si no lo pediste, ignorá este correo.</p>`),
  });
export const sendSensitiveActionEmail = (to, code) =>
  sendMail({
    to, subject: 'Código de confirmación de SPOTCHECK',
    text: `Código para confirmar una operación sensible: ${code}. Vence en ${env.CODE_TTL_MIN} minutos. Si no fuiste vos, cambiá tu contraseña.`,
    html: wrap('Confirmá la operación', `<p>Código de confirmación:</p>${codeBlock(code)}<p>Si no fuiste vos, cambiá tu contraseña.</p>`),
  });
