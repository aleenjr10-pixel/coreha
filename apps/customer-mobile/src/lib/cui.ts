export function normalizeCui(value: string) {
  return value.trim().toUpperCase().replace(/\s/g, '');
}

// Romanian company tax code: optional RO prefix followed by 2–10 digits.
export function isValidCui(value: string) {
  return /^(RO)?\d{2,10}$/.test(value);
}
