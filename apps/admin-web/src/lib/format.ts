import type { EquipmentCategory } from './types'

export const categoryLabels: Record<EquipmentCategory, string> = {
  refrigeration: 'Refrigeration',
  dishwasher: 'Dishwasher',
  ice_machine: 'Ice machine',
  cooking: 'Cooking equipment',
}

export function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function daysUntil(value: string) {
  return Math.ceil((new Date(value).getTime() - Date.now()) / 86_400_000)
}

// Matches the status-* classes in AdminApp.css.
export function statusClass(status: string) {
  return `status-label status-${status.toLowerCase().replaceAll(' ', '-')}`
}
