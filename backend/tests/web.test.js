import { describe, it, expect } from 'vitest';
import request from 'supertest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../src/app.js';

describe('versión web servida por el backend', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'web-'));
  fs.writeFileSync(path.join(dir, 'index.html'), '<!doctype html><title>SPOTCHECK</title>');
  const app = createApp({ webDir: dir });

  it('sirve index.html en / y en rutas de la app, sin tocar la API', async () => {
    expect((await request(app).get('/')).text).toContain('SPOTCHECK');
    expect((await request(app).get('/places/12')).text).toContain('SPOTCHECK');
    const api = await request(app).get('/api/v1/ruta-inexistente');
    expect(api.status).toBe(404);
    expect(api.body.error.code).toBe('NOT_FOUND');
    expect((await request(app).get('/uploads/nada.png')).status).toBe(404);
  });

  it('sin carpeta web no sirve nada en /', async () => {
    const res = await request(createApp({ webDir: path.join(dir, 'no-existe') })).get('/');
    expect(res.status).toBe(404);
  });

  it('la política de seguridad permite imágenes https pero no scripts ajenos', async () => {
    const csp = (await request(app).get('/')).headers['content-security-policy'];
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain('img-src');
  });
});
