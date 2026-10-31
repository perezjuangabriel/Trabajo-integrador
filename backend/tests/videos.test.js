import { describe, it, expect, afterAll } from 'vitest';
import { api, verifiedUser, staffAuth, uniq, db } from './helpers.js';
import { parseVideoUrl, embedUrlFor } from '../src/utils/videoUrl.js';

afterAll(() => db.end());
const V = '/api/v1/videos';
const vid = () => Math.random().toString(36).slice(2, 13).padEnd(11, 'x');
const body = (o = {}) => ({ title: uniq('Video'), description: 'Clip', url: `https://www.youtube.com/watch?v=${vid()}`, categoryId: 13, ...o });

describe('análisis de enlaces', () => {
  it('normaliza YouTube (watch, youtu.be, shorts, embed) al mismo enlace canónico', () => {
    const urls = ['https://www.youtube.com/watch?v=abcDEF12345&t=10', 'https://youtu.be/abcDEF12345', 'https://m.youtube.com/shorts/abcDEF12345', 'https://www.youtube.com/embed/abcDEF12345'];
    for (const u of urls) expect(parseVideoUrl(u)).toMatchObject({ url: 'https://www.youtube.com/watch?v=abcDEF12345', provider: 'youtube', externalId: 'abcDEF12345', embedUrl: 'https://www.youtube.com/embed/abcDEF12345' });
    expect(parseVideoUrl(urls[0]).thumbnailUrl).toBe('https://i.ytimg.com/vi/abcDEF12345/hqdefault.jpg');
  });
  it('reconoce Vimeo y trata otros sitios como enlace externo sin embed', () => {
    expect(parseVideoUrl('https://vimeo.com/123456789')).toMatchObject({ provider: 'vimeo', embedUrl: 'https://player.vimeo.com/video/123456789' });
    expect(parseVideoUrl('https://example.com/v/1#frag')).toMatchObject({ provider: 'other', embedUrl: null, url: 'https://example.com/v/1' });
    expect(embedUrlFor('other', null)).toBeNull();
  });
  it('rechaza esquemas peligrosos, credenciales y basura', () => {
    for (const bad of ['javascript:alert(1)', 'data:text/html,<script>', 'file:///etc/passwd', 'ftp://x.com/a', 'https://user:pw@x.com/v', 'no es url', '']) {
      expect(() => parseVideoUrl(bad)).toThrow();
    }
  });
});

describe('API de videos', () => {
  it('lista solo publicados, con filtros y orden; detalle por id', async () => {
    const all = await api().get(`${V}?pageSize=100`);
    expect(all.body.data.items.every((v) => v.status === 'published')).toBe(true);
    expect(all.body.data.items.map((v) => v.id)).not.toContain(6);       // el 6 está pendiente
    expect((await api().get(`${V}?categoryId=15`)).body.data.items.map((v) => v.id)).toEqual([3]);
    const byRating = (await api().get(`${V}?sort=rating&pageSize=100`)).body.data.items.map((v) => v.avgRating);
    expect(byRating).toEqual([...byRating].sort((a, b) => b - a));
    expect((await api().get(`${V}?q=kickflip`)).body.data.items.map((v) => v.id)).toEqual([3]);
    const d = (await api().get(`${V}/3`)).body.data.video;
    expect(d).toMatchObject({ provider: 'vimeo', embedUrl: 'https://player.vimeo.com/video/900000003' });
    expect((await api().get(`${V}/4`)).body.data.video.embedUrl).toBeNull();   // proveedor sin embed: la app abre el enlace
    expect((await api().get(`${V}/6`)).status).toBe(404);
    expect((await api().get(`${V}/abc`)).status).toBe(404);
  });
  it('un usuario verificado propone un video (pendiente) y se detectan duplicados aunque cambie el formato del enlace', async () => {
    const { auth } = await verifiedUser();
    const id = vid();
    const r = await api().post(V).set(auth).send(body({ url: `https://youtu.be/${id}?si=xyz` }));
    expect(r.status).toBe(201);
    expect(r.body.data.video).toMatchObject({ status: 'pending', provider: 'youtube', url: `https://www.youtube.com/watch?v=${id}`, embedUrl: `https://www.youtube.com/embed/${id}` });
    const dup = await api().post(V).set(auth).send(body({ url: `https://www.youtube.com/watch?v=${id}` }));
    expect(dup.body.error.code).toBe('VIDEO_ALREADY_EXISTS');
  });
  it('valida URL, categoría de tipo video y exige correo verificado', async () => {
    const { auth } = await verifiedUser();
    expect((await api().post(V).set(auth).send(body({ url: 'javascript:alert(1)' }))).status).toBe(400);
    expect((await api().post(V).set(auth).send(body({ categoryId: 1 }))).body.error.code).toBe('INVALID_CATEGORY');
    expect((await api().post(V).send(body())).status).toBe(401);
  });
  it('el staff publica directo; el autor edita su pendiente; el admin da de baja y restaura', async () => {
    const mod = await staffAuth('moderator');
    expect((await api().post(V).set(mod).send(body())).body.data.video.status).toBe('published');
    const { auth } = await verifiedUser();
    const v = (await api().post(V).set(auth).send(body())).body.data.video;
    const nu = vid();
    const e = await api().patch(`${V}/${v.id}`).set(auth).send({ title: 'Título corregido', url: `https://vimeo.com/${Math.floor(Math.random() * 9e8) + 1e8}` });
    expect(e.body.data.video).toMatchObject({ title: 'Título corregido', provider: 'vimeo' });
    const admin = await staffAuth('admin');
    expect((await api().delete(`${V}/${v.id}`).set(admin)).status).toBe(204);
    expect((await api().get(`${V}/${v.id}`).set(auth)).status).toBe(404);
    expect((await api().post(`${V}/${v.id}/restore`).set(admin)).status).toBe(204);
    expect(nu).toBeTruthy();
  });
});
