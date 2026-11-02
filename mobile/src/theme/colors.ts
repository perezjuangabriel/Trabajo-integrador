// Paleta índigo sobre grises azulados (claro y oscuro). Todos los componentes leen estos tokens (nunca colores sueltos).
export interface Palette {
  bg: string; surface: string; surfaceAlt: string; text: string; muted: string; border: string; primary: string; onPrimary: string;
  danger: string; success: string; warning: string; star: string; overlay: string; scheme: 'light' | 'dark';
}
export const light: Palette = {
  bg: '#F5F6FB', surface: '#FFFFFF', surfaceAlt: '#E9ECF6', text: '#111633', muted: '#5B6385', border: '#D8DCEB', primary: '#4338CA', onPrimary: '#FFFFFF',
  danger: '#C62828', success: '#15803D', warning: '#B45309', star: '#F59E0B', overlay: 'rgba(8,12,32,0.45)', scheme: 'light',
};
export const dark: Palette = {
  bg: '#0B1020', surface: '#131A2E', surfaceAlt: '#1C2540', text: '#EEF1FA', muted: '#98A2BD', border: '#26304D', primary: '#8B97FF', onPrimary: '#0B1020',
  danger: '#F87171', success: '#4ADE80', warning: '#FBBF24', star: '#FBBF24', overlay: 'rgba(0,0,0,0.65)', scheme: 'dark',
};
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { sm: 8, md: 12, lg: 18, pill: 999 };
