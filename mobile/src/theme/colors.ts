// Paleta índigo sobre grises azulados (claro y oscuro). Todos los componentes leen estos tokens (nunca colores sueltos).
export interface Palette {
  bg: string; surface: string; surfaceAlt: string; text: string; muted: string; border: string; primary: string; onPrimary: string;
  danger: string; success: string; warning: string; star: string; overlay: string; scheme: 'light' | 'dark';
}
export const light: Palette = {
  bg: '#F3F4FA', surface: '#FFFFFF', surfaceAlt: '#E8EBF6', text: '#0E1230', muted: '#586082', border: '#DADEEE', primary: '#5B3DF5', onPrimary: '#FFFFFF',
  danger: '#C62828', success: '#15803D', warning: '#B45309', star: '#F59E0B', overlay: 'rgba(8,12,32,0.45)', scheme: 'light',
};
export const dark: Palette = {
  bg: '#080A14', surface: '#12162A', surfaceAlt: '#1B2140', text: '#F1F3FC', muted: '#9AA3C2', border: '#242B4A', primary: '#9A86FF', onPrimary: '#0A0B16',
  danger: '#F87171', success: '#4ADE80', warning: '#FBBF24', star: '#FBBF24', overlay: 'rgba(0,0,0,0.65)', scheme: 'dark',
};
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { sm: 8, md: 12, lg: 18, pill: 999 };
