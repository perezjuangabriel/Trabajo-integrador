import { describe, it, expect, vi, afterEach } from 'vitest';

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); delete process.env.BREVO_API_KEY; });

describe('envío por Brevo', () => {
  it('usa la API de Brevo con remitente y destinatario correctos', async () => {
    process.env.BREVO_API_KEY = 'k';
    process.env.MAIL_FROM = 'SPOTCHECK <yo@example.com>';
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    const { sendMail } = await import('../src/services/mail.service.js');
    const r = await sendMail({ to: 'profe@example.com', subject: 's', html: '<p>x</p>', text: 'x' });
    expect(r.sent).toBe(true);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.sender).toEqual({ name: 'SPOTCHECK', email: 'yo@example.com' });
    expect(body.to).toEqual([{ email: 'profe@example.com' }]);
  });
  it('informa fallo si Brevo rechaza', async () => {
    process.env.BREVO_API_KEY = 'k';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401, text: async () => 'no' }));
    const { sendMail } = await import('../src/services/mail.service.js');
    expect((await sendMail({ to: 'a@b.co', subject: 's', html: '', text: '' })).sent).toBe(false);
  });
});
