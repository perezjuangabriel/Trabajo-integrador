import { describe, it, expect } from 'vitest';
import { allowNavigation, playerHtml } from '../src/lib/embed';

describe('reproductor embebido', () => {
  it('arma un iframe con playsinline y sin comillas sueltas', () => {
    const h = playerHtml('https://www.youtube.com/embed/abcDEF12345');
    expect(h).toContain('src="https://www.youtube.com/embed/abcDEF12345?playsinline=1&rel=0"');
    expect(h).toContain('allowfullscreen');
    expect(playerHtml('https://x.test/a?b=1')).toContain('?b=1&playsinline=1');
    expect(playerHtml('https://x.test/"><script>')).not.toContain('"><script>');
  });
  it('solo permite navegar dentro del proveedor', () => {
    const base = 'https://spotcheck.test';
    expect(allowNavigation('about:blank', base)).toBe(true);
    expect(allowNavigation('https://spotcheck.test/', base)).toBe(true);
    expect(allowNavigation('https://www.youtube.com/embed/x', base)).toBe(true);
    expect(allowNavigation('https://evil.example/phish', base)).toBe(false);
    expect(allowNavigation('https://evil.example/frame', base, false)).toBe(true); // marcos internos: Android no los reporta
    expect(allowNavigation('javascript:alert(1)', base)).toBe(false);
  });
});
