// Dark theme shared with the admin website: deep charcoal surfaces, electric turquoise
// for actions, amber and intense red for alerts.
export const colors = {
  accent: '#1ccfd9',
  accentStrong: '#5fe3ea',
  accentSoft: 'rgba(28, 207, 217, 0.14)',
  accentBorder: 'rgba(28, 207, 217, 0.34)',
  onAccent: '#042a2e',
  background: '#17191d',
  surface: '#20242a',
  surfaceRaised: '#272c33',
  border: '#30363e',
  inputBorder: '#414952',
  inputBackground: '#1c1f24',
  text: '#f3f6f8',
  textStrong: '#ffffff',
  body: '#d6dce1',
  textMuted: '#a1aab3',
  textFaint: '#7d8790',
  label: '#8f99a3',
  danger: '#ff6b5c',
  dangerSoft: 'rgba(255, 59, 48, 0.14)',
  dangerBorder: 'rgba(255, 59, 48, 0.4)',
  warning: '#fbbf24',
  warningSoft: 'rgba(251, 191, 36, 0.14)',
  success: '#4ade80',
  neutralSoft: 'rgba(255, 255, 255, 0.07)',
};

// Inter, loaded in the root layout. Android needs one family per weight.
export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  extrabold: 'Inter_800ExtraBold',
};

// Soft, diffuse shadow so cards float above the background.
export const floating = {
  shadowColor: '#000',
  shadowOpacity: 0.35,
  shadowRadius: 18,
  shadowOffset: { width: 0, height: 8 },
  elevation: 6,
};

export const categoryLabels = {
  refrigeration: 'Refrigeration',
  dishwasher: 'Washing',
  ice_machine: 'Ice',
  cooking: 'Cooking',
} as const;

export function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatMoney(value: number | null | undefined) {
  if (value == null) return '—';
  return `${Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 })} RON`;
}
