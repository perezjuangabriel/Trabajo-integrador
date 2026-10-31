// Paleta urbana: hormigón, asfalto y naranja de seguridad. Todos los componentes leen estos tokens (nunca colores sueltos).
export interface Palette {
  bg: string; surface: string; surfaceAlt: string; text: string; muted: string; border: string; primary: string; onPrimary: string;
  danger: string; success: string; warning: string; star: string; overlay: string; scheme: 'light' | 'dark';
}
export const light: Palette = {
  bg: '#F3F1EC', surface: '#FFFFFF', surfaceAlt: '#E9E6DF', text: '#16130F', muted: '#6B655C', border: '#DAD5CB', primary: '#E8500A', onPrimary: '#FFFFFF',
  danger: '#C62828', success: '#18803C', warning: '#A8530A', star: '#F5A300', overlay: 'rgba(0,0,0,0.45)', scheme: 'light',
};
export const dark: Palette = {
  bg: '#0E0E10', surface: '#18181B', surfaceAlt: '#232327', text: '#F5F3EF', muted: '#A39D92', border: '#2E2E34', primary: '#FF6A2A', onPrimary: '#1A0A02',
  danger: '#FF6B6B', success: '#4ADE80', warning: '#FBB04A', star: '#FFC233', overlay: 'rgba(0,0,0,0.65)', scheme: 'dark',
};
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { sm: 8, md: 12, lg: 18, pill: 999 };
