import { useState } from 'react'
import { Activity, BellRing, CheckCheck, Snowflake, Utensils, Waves } from 'lucide-react'
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
  'id, restaurant_id, category, label, maintenance_frequency_days, last_service_at, next_due_at, status, notes, restaurants(legal_name, city), alert_events(id, status, scheduled_for, delivered_at)'

// Soonest due first; items without a due date go last.
// eslint-disable-next-line react-refresh/only-export-components
export function sortByDue(rows: EquipmentRow[]) {
  return [...rows].sort((a, b) => {
    if (!a.next_due_at) return b.next_due_at ? 1 : 0
    if (!b.next_due_at) return -1
    return new Date(a.next_due_at).getTime() - new Date(b.next_due_at).getTime()
  })
}

// eslint-disable-next-line react-refresh/only-export-components
export function equipmentState(item: EquipmentRow): { label: string; tone: string; attention: boolean } {
  const alert = item.alert_events[0]
  if (alert?.status === 'scheduled') {
    return { label: `Cleaning ${formatDate(alert.scheduled_for)}`, tone: 'offers-received', attention: true }
  }
  if (alert?.status === 'sent') return { label: 'Alert sent', tone: 'rfq-sent', attention: true }
  if (alert?.status === 'acknowledged') return { label: 'Confirmed', tone: 'rfq-sent', attention: true }
  if (item.status === 'maintenance') return { label: 'In service', tone: 'due-soon', attention: false }
  if (!item.next_due_at) return { label: 'Not scheduled', tone: 'setup-pending', attention: false }

  const days = daysUntil(item.next_due_at)
  if (days < 0) return { label: `Overdue ${-days}d`, tone: 'overdue', attention: true }
  if (days <= 7) return { label: days === 0 ? 'Due today' : `Due in ${days}d`, tone: 'due-soon', attention: true }
  return { label: 'On schedule', tone: 'on-schedule', attention: false }
}

export function EquipmentTable({
  rows,
  onChanged,
  showActions = true,
  showRestaurant = true,
}: {
  rows: EquipmentRow[]
  onChanged: () => void
  showActions?: boolean
  showRestaurant?: boolean
}) {
  const toast = useToast()
  const [busyId, setBusyId] = useState<string | null>(null)

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
            <th>EQUIPMENT</th>{showRestaurant && <th>RESTAURANT</th>}<th>FREQUENCY</th><th>LAST CLEANED</th><th>NEXT CLEAN</th><th>STATUS</th>
            {showActions && <th>ACTIONS</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((item) => {
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
                <td><StatusLabel label={state.label} tone={state.tone} /></td>
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
