import type { AlertEvent, EquipmentItem } from './types';

const DAY_MS = 24 * 60 * 60 * 1000;

export type Tone = 'neutral' | 'good' | 'warning' | 'danger';

export type OpenAlert = Pick<AlertEvent, 'id' | 'status' | 'alert_message' | 'delivered_at' | 'scheduled_for'>;

export type EquipmentWithAlerts = EquipmentItem & { alert_events: OpenAlert[] };

export const frequencyPresets = [7, 14, 30, 60, 90, 180];

export function frequencyLabel(days: number) {
  if (days % 30 === 0) {
    const months = days / 30;
    return months === 1 ? 'Every month' : `Every ${months} months`;
  }
  if (days % 7 === 0) {
    const weeks = days / 7;
    return weeks === 1 ? 'Every week' : `Every ${weeks} weeks`;
  }
  return days === 1 ? 'Every day' : `Every ${days} days`;
}

export function daysUntil(value: string) {
  return Math.ceil((new Date(value).getTime() - Date.now()) / DAY_MS);
}

export function dueBadge(item: EquipmentItem): { label: string; tone: Tone } {
  if (item.status === 'maintenance') return { label: 'In service', tone: 'warning' };
  if (item.status === 'inactive') return { label: 'Inactive', tone: 'neutral' };
  if (!item.next_due_at) return { label: 'Not scheduled', tone: 'neutral' };

  const daysLeft = daysUntil(item.next_due_at);
  if (daysLeft < 0) return { label: `Overdue ${-daysLeft}d`, tone: 'danger' };
  if (daysLeft === 0) return { label: 'Due today', tone: 'danger' };
  if (daysLeft <= 7) return { label: `Due in ${daysLeft}d`, tone: 'warning' };
  return { label: `Due in ${daysLeft}d`, tone: 'good' };
}

// Soonest due first; items without a due date go last.
export function compareByDueDate(a: EquipmentItem, b: EquipmentItem) {
  if (!a.next_due_at) return b.next_due_at ? 1 : a.label.localeCompare(b.label);
  if (!b.next_due_at) return -1;
  return new Date(a.next_due_at).getTime() - new Date(b.next_due_at).getTime();
}

export function nextDays(count: number) {
  const base = new Date();
  base.setHours(9, 0, 0, 0);
  return Array.from({ length: count }, (_, i) => {
    const day = new Date(base);
    day.setDate(base.getDate() + i);
    return day;
  });
}

export function dayLabel(day: Date, index: number) {
  if (index === 0) return 'Today';
  if (index === 1) return 'Tomorrow';
  return day.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}
