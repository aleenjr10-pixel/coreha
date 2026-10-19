import { useState, type FormEvent } from 'react'
import { categoryLabels } from '../lib/format'
import { errorMessage, supabase } from '../lib/supabase'
import { useToast } from '../lib/toast'
import type { EquipmentCategory } from '../lib/types'
import { Modal } from './ui'

export type RestaurantOption = { id: string; legal_name: string; city: string | null }

const categories = Object.keys(categoryLabels) as EquipmentCategory[]

export function AddEquipmentModal({
  restaurants,
  defaultRestaurant,
  onClose,
  onSaved,
}: {
  restaurants: RestaurantOption[]
  defaultRestaurant: string
  onClose: () => void
  onSaved: () => void
}) {
  const toast = useToast()
  const [form, setForm] = useState({
    restaurantId: defaultRestaurant || restaurants[0]?.id || '',
    label: '',
    category: 'refrigeration' as EquipmentCategory,
    frequency: '30',
    lastCleaned: '',
    notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [todayIso] = useState(() => new Date().toISOString().slice(0, 10))

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    const frequency = Number.parseInt(form.frequency, 10)
    const lastCleaned = form.lastCleaned ? new Date(`${form.lastCleaned}T09:00:00`) : null
    try {
      const { error: insertError } = await supabase.from('equipment_items').insert({
        restaurant_id: form.restaurantId,
        label: form.label.trim(),
        category: form.category,
        maintenance_frequency_days: frequency,
        last_service_at: lastCleaned?.toISOString() ?? null,
        // With a last-cleaned date the database trigger computes this; otherwise start the cycle today.
        next_due_at: lastCleaned ? null : new Date(Date.now() + frequency * 86_400_000).toISOString(),
        notes: form.notes.trim() || null,
      })
      if (insertError) throw insertError
      toast(`${form.label.trim()} added to the inventory.`)
      onSaved()
    } catch (err) {
      setError(errorMessage(err, 'Unable to add the equipment.'))
      setSaving(false)
    }
  }

  return (
    <Modal
      kicker="DIGITAL INVENTORY"
      title="Add equipment"
      description="Register a machine after the on-site assessment. The restaurant sees it in the mobile app right away."
      onClose={onClose}
      onSubmit={handleSubmit}
      submitLabel="Add equipment"
      submitting={saving}
    >
      <label>Restaurant
        <select required value={form.restaurantId} onChange={(event) => update('restaurantId', event.target.value)}>
          {restaurants.map((item) => <option key={item.id} value={item.id}>{item.legal_name}{item.city ? ` · ${item.city}` : ''}</option>)}
        </select>
      </label>
      <label>Name
        <input required minLength={2} value={form.label} onChange={(event) => update('label', event.target.value)} placeholder="e.g. Walk-in cold room, kitchen" />
      </label>
      <div className="admin-form-grid">
        <label>Category
          <select value={form.category} onChange={(event) => update('category', event.target.value as EquipmentCategory)}>
            {categories.map((value) => <option key={value} value={value}>{categoryLabels[value]}</option>)}
          </select>
        </label>
        <label>Cleaning every (days)
          <input required type="number" min={1} max={730} value={form.frequency} onChange={(event) => update('frequency', event.target.value)} />
        </label>
      </div>
      <label>Last cleaned (optional)
        <input type="date" max={todayIso} value={form.lastCleaned} onChange={(event) => update('lastCleaned', event.target.value)} />
      </label>
      <label>Notes (optional)
        <input value={form.notes} onChange={(event) => update('notes', event.target.value)} placeholder="Location, model, serial number" />
      </label>
      {error && <div className="login-error">{error}</div>}
    </Modal>
  )
}
