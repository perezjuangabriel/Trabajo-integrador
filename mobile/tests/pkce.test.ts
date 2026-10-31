import { describe, it, expect } from 'vitest';
import { createHash, randomBytes } from 'node:crypto';
import { bytesToBase64Url, createPkce, parseAuthRedirect, toBase64Url } from '../src/lib/pkce';

describe('PKCE', () => {
  it('bytesToBase64Url coincide con la codificación base64url de Node (todos los largos)', () => {
    for (const n of [1, 2, 3, 4, 31, 32, 33, 64]) {
      const b = randomBytes(n);
      expect(bytesToBase64Url(new Uint8Array(b))).toBe(b.toString('base64url'));
    }
  });
  it('el verifier tiene 43 caracteres y el challenge es base64url(sha256(verifier)) como lo valida el servidor', async () => {
    const sha = async (s: string) => createHash('sha256').update(s).digest('base64');
    const { verifier, challenge } = await createPkce((n) => new Uint8Array(randomBytes(n)), sha);
    expect(verifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(challenge).toBe(createHash('sha256').update(verifier).digest('base64url'));
    expect(challenge).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });
  it('toBase64Url cambia +/ por -_ y quita el relleno', () => expect(toBase64Url('a+b/c==')).toBe('a-b_c'));
  it('parseAuthRedirect lee code, error y linked', () => {
    expect(parseAuthRedirect('spotcheck://auth?code=abc123')).toEqual({ code: 'abc123', error: undefined, linked: undefined });
    expect(parseAuthRedirect('spotcheck://auth?error=ACCOUNT_SUSPENDED')).toMatchObject({ error: 'ACCOUNT_SUSPENDED' });
    expect(parseAuthRedirect('exp://192.168.0.2:8081/--/auth?linked=google#x')).toMatchObject({ linked: 'google' });
    expect(parseAuthRedirect('spotcheck://auth')).toEqual({ code: undefined, error: undefined, linked: undefined });
  });
});
