import { useMemo, useState } from 'react'
import { Activity, BellRing, CheckCheck, ChevronDown, ChevronsUpDown, ChevronUp, Snowflake, Utensils, Waves } from 'lucide-react'
import { categoryLabels, daysUntil, formatDate } from '../lib/format'
import { errorMessage, supabase } from '../lib/supabase'
import { useToast } from '../lib/toast'
import type { EquipmentCategory, EquipmentRow } from '../lib/types'
import { StatusLabel } from './ui'

const categoryIcons: Record<EquipmentCategory, typeof Snowflake> = {
  refrigeration: Snowflake,
  dishwasher: Waves,
  ice_machine: Activity,
  cooking: Utensils,
}

// eslint-disable-next-line react-refresh/only-export-components
export const equipmentSelect =
  'id, restaurant_id, category, label, maintenance_frequency_days, last_service_at, next_due_at, status, notes, restaurants(legal_name, city), alert_events(id, status, scheduled_for, delivered_at, push_device_count, push_sent_at, push_error)'

// Soonest due first; items without a due date go last.
// eslint-disable-next-line react-refresh/only-export-components
export function sortByDue(rows: EquipmentRow[]) {
  return [...rows].sort((a, b) => {
    if (!a.next_due_at) return b.next_due_at ? 1 : 0
    if (!b.next_due_at) return -1
    return new Date(a.next_due_at).getTime() - new Date(b.next_due_at).getTime()
  })
}

// rank orders the Status column by urgency (0 = most urgent).
// eslint-disable-next-line react-refresh/only-export-components
export function equipmentState(item: EquipmentRow): { label: string; tone: string; attention: boolean; rank: number } {
  const alert = item.alert_events[0]
  if (alert?.status === 'sent') return { label: 'Alert sent', tone: 'rfq-sent', attention: true, rank: 0 }
  if (alert?.status === 'scheduled') {
    return { label: `Cleaning ${formatDate(alert.scheduled_for)}`, tone: 'offers-received', attention: true, rank: 1 }
  }
  if (alert?.status === 'acknowledged') return { label: 'Confirmed', tone: 'rfq-sent', attention: true, rank: 1 }
  if (item.status === 'maintenance') return { label: 'In service', tone: 'due-soon', attention: false, rank: 3 }
  if (!item.next_due_at) return { label: 'Not scheduled', tone: 'setup-pending', attention: false, rank: 5 }

  const days = daysUntil(item.next_due_at)
  if (days < 0) return { label: `Overdue ${-days}d`, tone: 'overdue', attention: true, rank: 0 }
  if (days <= 7) return { label: days === 0 ? 'Due today' : `Due in ${days}d`, tone: 'due-soon', attention: true, rank: days === 0 ? 0 : 2 }
  return { label: 'On schedule', tone: 'on-schedule', attention: false, rank: 4 }
}

export type EquipmentSortKey = 'label' | 'restaurant' | 'frequency' | 'last' | 'next' | 'status'
export type EquipmentSort = { key: EquipmentSortKey; direction: 'asc' | 'desc' }

// eslint-disable-next-line react-refresh/only-export-components
export const defaultEquipmentSort: EquipmentSort = { key: 'next', direction: 'asc' }

const time = (value: string | null) => (value ? new Date(value).getTime() : null)

function sortValue(item: EquipmentRow, key: EquipmentSortKey): string | number | null {
  switch (key) {
    case 'label': return item.label.toLowerCase()
    case 'restaurant': return item.restaurants?.legal_name.toLowerCase() ?? null
    case 'frequency': return item.maintenance_frequency_days
    case 'last': return time(item.last_service_at)
    case 'next': return time(item.next_due_at)
    case 'status': return equipmentState(item).rank
  }
}

// Empty values stay at the bottom in both directions; ties fall back to the next due date.
// eslint-disable-next-line react-refresh/only-export-components
export function sortEquipment(rows: EquipmentRow[], sort: EquipmentSort) {
  const factor = sort.direction === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => {
    const left = sortValue(a, sort.key)
    const right = sortValue(b, sort.key)
    if (left !== right) {
      if (left === null) return 1
      if (right === null) return -1
      return (left < right ? -1 : 1) * factor
    }
    const dueA = time(a.next_due_at)
    const dueB = time(b.next_due_at)
    if (dueA === dueB) return a.label.localeCompare(b.label)
    if (dueA === null) return 1
    if (dueB === null) return -1
    return dueA - dueB
  })
}

function SortHeader({
  label,
  column,
  sort,
  onSort,
}: {
  label: string
  column: EquipmentSortKey
  sort: EquipmentSort
  onSort: (key: EquipmentSortKey) => void
}) {
  const active = sort.key === column
  const Icon = !active ? ChevronsUpDown : sort.direction === 'asc' ? ChevronUp : ChevronDown
  return (
    <th aria-sort={active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button type="button" className={`sort-button ${active ? 'sort-active' : ''}`} onClick={() => onSort(column)}>
        {label}
        <Icon size={11} />
      </button>
    </th>
  )
}

// Delivery log for an alert waiting on the restaurant.
function PushDelivery({ alert }: { alert: EquipmentRow['alert_events'][number] }) {
  if (alert.push_device_count > 0) {
    return (
      <div className="push-delivery" title={alert.push_sent_at ? `Last sent ${formatDate(alert.push_sent_at)}` : undefined}>
        Sent to {alert.push_device_count} {alert.push_device_count === 1 ? 'phone' : 'phones'}
      </div>
    )
  }
  return <div className="push-delivery push-delivery-missing" title={alert.push_error ?? undefined}>{alert.push_error === 'No phone registered' ? 'No phone registered' : 'Push not delivered'}</div>
}

export function EquipmentTable({
  rows,
  onChanged,
  showActions = true,
  showRestaurant = true,
  sort: controlledSort,
  onSortChange,
}: {
  rows: EquipmentRow[]
  onChanged: () => void
  showActions?: boolean
  showRestaurant?: boolean
  // Pass both to share one sort across several tables; otherwise each table sorts on its own.
  sort?: EquipmentSort
  onSortChange?: (sort: EquipmentSort) => void
}) {
  const toast = useToast()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [localSort, setLocalSort] = useState<EquipmentSort>(defaultEquipmentSort)
  const sort = controlledSort ?? localSort
  const sortedRows = useMemo(() => sortEquipment(rows, sort), [rows, sort])

  // Clicking the active column flips its direction; a new column starts ascending.
  function changeSort(key: EquipmentSortKey) {
    const next: EquipmentSort = { key, direction: sort.key === key && sort.direction === 'asc' ? 'desc' : 'asc' }
    if (onSortChange) onSortChange(next)
    else setLocalSort(next)
  }

  async function act(item: EquipmentRow, action: () => Promise<void>, success: string) {
    setBusyId(item.id)
    try {
      await action()
      toast(success)
      onChanged()
    } catch (err) {
      toast(errorMessage(err, 'Something went wrong.'), 'error')
    } finally {
      setBusyId(null)
    }
  }

  function sendAlert(item: EquipmentRow) {
    return act(item, async () => {
      const { error } = await supabase.from('alert_events').insert({
        restaurant_id: item.restaurant_id,
        equipment_item_id: item.id,
        alert_message: `Equipment ${item.label} requires periodic maintenance.`,
      })
      if (error) throw error
    }, `Alert sent to ${item.restaurants?.legal_name ?? 'the restaurant'}.`)
  }

  function markCleaned(item: EquipmentRow) {
    return act(item, async () => {
      // The next due date is recalculated by the database trigger.
      const { error } = await supabase
        .from('equipment_items')
        .update({ last_service_at: new Date().toISOString(), status: 'active' })
        .eq('id', item.id)
      if (error) throw error
      const openIds = item.alert_events.map((alert) => alert.id)
      if (openIds.length) {
        const { error: alertError } = await supabase.from('alert_events').update({ status: 'resolved' }).in('id', openIds)
        if (alertError) throw alertError
      }
    }, `${item.label} marked as cleaned.`)
  }

  return (
    <div className="table-scroll">
      <table className="admin-table">
        <thead>
          <tr>
            <SortHeader label="EQUIPMENT" column="label" sort={sort} onSort={changeSort} />
            {showRestaurant && <SortHeader label="RESTAURANT" column="restaurant" sort={sort} onSort={changeSort} />}
            <SortHeader label="FREQUENCY" column="frequency" sort={sort} onSort={changeSort} />
            <SortHeader label="LAST CLEANED" column="last" sort={sort} onSort={changeSort} />
            <SortHeader label="NEXT CLEAN" column="next" sort={sort} onSort={changeSort} />
            <SortHeader label="STATUS" column="status" sort={sort} onSort={changeSort} />
            {showActions && <th>ACTIONS</th>}
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((item) => {
            const Icon = categoryIcons[item.category]
            const state = equipmentState(item)
            const busy = busyId === item.id
            return (
              <tr key={item.id}>
                <td>
                  <div className="business-cell">
                    <span className="business-avatar asset-avatar"><Icon size={16} /></span>
                    <span><strong>{item.label}</strong><small>{categoryLabels[item.category]}</small></span>
                  </div>
                </td>
                {showRestaurant && (
                  <td>{item.restaurants?.legal_name ?? '—'}<br /><span className="muted-value">{item.restaurants?.city ?? ''}</span></td>
                )}
                <td>{item.maintenance_frequency_days} days</td>
                <td>{formatDate(item.last_service_at)}</td>
                <td>{formatDate(item.next_due_at)}</td>
                <td>
                  <StatusLabel label={state.label} tone={state.tone} />
                  {item.alert_events[0]?.status === 'sent' && <PushDelivery alert={item.alert_events[0]} />}
                </td>
                {showActions && (
                  <td>
                    <div className="row-actions">
                      {item.alert_events.length === 0 && (
                        <button className="row-button" type="button" disabled={busy} onClick={() => sendAlert(item)}>
                          <BellRing size={13} /> Send alert
                        </button>
                      )}
                      <button className="row-button" type="button" disabled={busy} onClick={() => markCleaned(item)}>
                        <CheckCheck size={13} /> Mark cleaned
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
      {rows.length === 0 && <div className="empty-table">No equipment found.</div>}
    </div>
  )
}
