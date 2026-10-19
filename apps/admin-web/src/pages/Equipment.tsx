import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { ChevronDown, Plus, Search } from 'lucide-react'
import { EquipmentTable, equipmentSelect, equipmentState, sortByDue } from '../components/EquipmentTable'
import { AddEquipmentModal, type RestaurantOption } from '../components/AddEquipmentModal'
import { LoadState, PageHeading } from '../components/ui'
import { categoryLabels } from '../lib/format'
import { supabase } from '../lib/supabase'
import type { EquipmentRow } from '../lib/types'
import { useQuery } from '../lib/useQuery'

export function Equipment() {
  const [params, setParams] = useSearchParams()
  const restaurantFilter = params.get('restaurant') ?? ''
  const [search, setSearch] = useState('')
  const [attentionOnly, setAttentionOnly] = useState(false)
  const [adding, setAdding] = useState(false)

  const equipment = useQuery(async () => {
    const { data, error } = await supabase
      .from('equipment_items')
      .select(equipmentSelect)
      .neq('status', 'retired')
      .neq('alert_events.status', 'resolved')
      .order('delivered_at', { referencedTable: 'alert_events', ascending: false })
      .returns<EquipmentRow[]>()
    if (error) throw error
    return sortByDue(data)
  }, [])

  const restaurants = useQuery(async () => {
    const { data, error } = await supabase
      .from('restaurants')
      .select('id, legal_name, city')
      .order('legal_name')
      .returns<RestaurantOption[]>()
    if (error) throw error
    return data
  }, [])

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return (equipment.data ?? []).filter((item) =>
      (!restaurantFilter || item.restaurant_id === restaurantFilter)
      && (!attentionOnly || equipmentState(item).attention)
      && `${item.label} ${item.restaurants?.legal_name ?? ''} ${categoryLabels[item.category]}`.toLowerCase().includes(query),
    )
  }, [equipment.data, restaurantFilter, attentionOnly, search])

  function setRestaurantFilter(value: string) {
    setParams(value ? { restaurant: value } : {})
  }

  return (
    <>
      <PageHeading
        eyebrow="EQUIPMENT CARE"
        title="Restaurant assets"
        description="Inventory added after on-site assessments, sorted by the next cleaning date."
        action={
          <button className="admin-primary-button" type="button" onClick={() => setAdding(true)} disabled={!restaurants.data?.length}>
            <Plus size={16} /> Add equipment
          </button>
        }
      />

      <section className="admin-panel directory-panel">
        <div className="directory-toolbar">
          <label className="admin-search">
            <Search size={16} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search equipment, restaurant, category" />
          </label>
          <label className="admin-select">
            <span className="sr-only">Restaurant</span>
            <select value={restaurantFilter} onChange={(event) => setRestaurantFilter(event.target.value)}>
              <option value="">All restaurants</option>
              {restaurants.data?.map((item) => <option key={item.id} value={item.id}>{item.legal_name}</option>)}
            </select>
            <ChevronDown size={14} />
          </label>
          <label className="admin-checkbox">
            <input type="checkbox" checked={attentionOnly} onChange={(event) => setAttentionOnly(event.target.checked)} />
            Needs attention
          </label>
          <span className="result-count">{filtered.length} assets</span>
        </div>
        <LoadState loading={equipment.loading} error={equipment.error} onRetry={equipment.reload} />
        {equipment.data && <EquipmentTable rows={filtered} onChanged={equipment.reload} />}
      </section>

      {adding && restaurants.data && (
        <AddEquipmentModal
          restaurants={restaurants.data}
          defaultRestaurant={restaurantFilter}
          onClose={() => setAdding(false)}
          onSaved={() => {
            setAdding(false)
            equipment.reload()
          }}
        />
      )}
    </>
  )
}
