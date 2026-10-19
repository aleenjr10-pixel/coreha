export const colors = {
  green: '#286d53',
  greenSoft: '#eaf1e7',
  greenBorder: '#dce7d9',
  background: '#f3f6f3',
  surface: '#ffffff',
  border: '#e2e8e2',
  inputBorder: '#dfe6df',
  inputBackground: '#f9faf9',
  text: '#213128',
  textStrong: '#243328',
  textMuted: '#67776d',
  textFaint: '#879188',
  label: '#758177',
  danger: '#a74438',
  dangerSoft: '#f8e9e6',
  warning: '#9a6a12',
  warningSoft: '#f8f0dc',
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
