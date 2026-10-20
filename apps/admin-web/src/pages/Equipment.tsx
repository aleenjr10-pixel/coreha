import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { BellRing, ChevronDown, ChevronRight, ExternalLink, Plus, Search } from 'lucide-react'
import { AddEquipmentModal, type RestaurantOption } from '../components/AddEquipmentModal'
import {
  defaultEquipmentSort,
  EquipmentTable,
  equipmentSelect,
  equipmentState,
  type EquipmentSort,
} from '../components/EquipmentTable'
import { LoadState, PageHeading } from '../components/ui'
import { categoryLabels, formatDate } from '../lib/format'
import { errorMessage, supabase } from '../lib/supabase'
import { useToast } from '../lib/toast'
import type { EquipmentRow } from '../lib/types'
import { useQuery } from '../lib/useQuery'

type RestaurantGroup = {
  restaurant: RestaurantOption
  items: EquipmentRow[]
  attention: number
  nextDue: number | null
}

// Restaurants that need attention first, then the one whose next cleaning comes soonest.
function compareGroups(a: RestaurantGroup, b: RestaurantGroup) {
  if ((a.attention > 0) !== (b.attention > 0)) return a.attention > 0 ? -1 : 1
  if (a.nextDue !== b.nextDue) {
    if (a.nextDue === null) return 1
    if (b.nextDue === null) return -1
    return a.nextDue - b.nextDue
  }
  return a.restaurant.legal_name.localeCompare(b.restaurant.legal_name)
}

export function Equipment() {
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const restaurantFilter = params.get('restaurant') ?? ''
  const [search, setSearch] = useState('')
  const [attentionOnly, setAttentionOnly] = useState(false)
  const [sort, setSort] = useState<EquipmentSort>(defaultEquipmentSort)
  // null until the user expands or collapses something: then restaurants needing attention start open.
  const [expanded, setExpanded] = useState<Set<string> | null>(null)
  const [addingFor, setAddingFor] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)

  const equipment = useQuery(async () => {
    const { data, error } = await supabase
      .from('equipment_items')
      .select(equipmentSelect)
      .neq('status', 'retired')
      .neq('alert_events.status', 'resolved')
      .order('delivered_at', { referencedTable: 'alert_events', ascending: false })
      .returns<EquipmentRow[]>()
    if (error) throw error
    return data
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

  // Same check pg_cron runs every morning.
  async function runDueCheck() {
    setChecking(true)
    try {
      const { data, error } = await supabase.rpc('generate_due_alerts')
      if (error) throw error
      const { created = 0, renotified = 0 } = (data ?? {}) as { created?: number; renotified?: number }
      toast(created || renotified
        ? `${created} new ${created === 1 ? 'alert' : 'alerts'} sent${renotified ? `, ${renotified} reminder${renotified === 1 ? '' : 's'} re-sent` : ''}.`
        : 'Nothing is due. No alerts sent.')
      equipment.reload()
    } catch (err) {
      toast(errorMessage(err, 'Unable to run the check.'), 'error')
    } finally {
      setChecking(false)
    }
  }

  const query = search.trim().toLowerCase()
  const filtering = Boolean(query || attentionOnly)

  const groups = useMemo(() => {
    const byRestaurant = new Map<string, EquipmentRow[]>()
    for (const item of equipment.data ?? []) {
      const list = byRestaurant.get(item.restaurant_id) ?? []
      list.push(item)
      byRestaurant.set(item.restaurant_id, list)
    }

    const result: RestaurantGroup[] = []
    for (const restaurant of restaurants.data ?? []) {
      if (restaurantFilter && restaurant.id !== restaurantFilter) continue
      const all = byRestaurant.get(restaurant.id) ?? []
      const restaurantMatches = !query || restaurant.legal_name.toLowerCase().includes(query) || (restaurant.city ?? '').toLowerCase().includes(query)
      const items = all.filter((item) =>
        (!attentionOnly || equipmentState(item).attention)
        && (restaurantMatches || `${item.label} ${categoryLabels[item.category]}`.toLowerCase().includes(query)),
      )
      // While searching or filtering, hide restaurants with nothing to show.
      if (filtering && items.length === 0) continue

      const dueTimes = all.map((item) => (item.next_due_at ? new Date(item.next_due_at).getTime() : null)).filter((value): value is number => value !== null)
      result.push({
        restaurant,
        items,
        attention: all.filter((item) => equipmentState(item).attention).length,
        nextDue: dueTimes.length ? Math.min(...dueTimes) : null,
      })
    }
    return result.sort(compareGroups)
  }, [equipment.data, restaurants.data, restaurantFilter, query, attentionOnly, filtering])

  const defaultExpanded = useMemo(() => new Set(groups.filter((group) => group.attention > 0).map((group) => group.restaurant.id)), [groups])
  const openIds = expanded ?? defaultExpanded
  // Search results are always shown open.
  const isOpen = (id: string) => filtering || openIds.has(id)

  function toggle(id: string) {
    const next = new Set(openIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setExpanded(next)
  }

  const totalItems = groups.reduce((sum, group) => sum + group.items.length, 0)
  const loading = equipment.loading || restaurants.loading
  const error = equipment.error ?? restaurants.error

  return (
    <>
      <PageHeading
        eyebrow="EQUIPMENT CARE"
        title="Restaurant assets"
        description="Equipment grouped by restaurant. Restaurants with a red dot have equipment that needs attention."
        action={
          <div className="heading-actions">
            <button className="admin-secondary-button" type="button" onClick={runDueCheck} disabled={checking} aria-busy={checking} title="Sends an alert for every machine due today or overdue. Runs automatically every morning.">
              <BellRing size={15} /> {checking ? 'Checking…' : 'Run due-date check'}
            </button>
            <button className="admin-primary-button" type="button" onClick={() => setAddingFor(restaurantFilter)} disabled={!restaurants.data?.length}>
              <Plus size={16} /> Add equipment
            </button>
          </div>
        }
      />

      <section className="admin-panel directory-panel">
        <div className="directory-toolbar">
          <label className="admin-search">
            <Search size={16} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search restaurant, equipment, category" />
          </label>
          <label className="admin-select">
            <span className="sr-only">Restaurant</span>
            <select value={restaurantFilter} onChange={(event) => setParams(event.target.value ? { restaurant: event.target.value } : {})}>
              <option value="">All restaurants</option>
              {restaurants.data?.map((item) => <option key={item.id} value={item.id}>{item.legal_name}</option>)}
            </select>
            <ChevronDown size={14} />
          </label>
          <label className="admin-checkbox">
            <input type="checkbox" checked={attentionOnly} onChange={(event) => setAttentionOnly(event.target.checked)} />
            Needs attention
          </label>
          {!filtering && groups.length > 0 && (
            <>
              <button className="admin-text-button" type="button" onClick={() => setExpanded(new Set(groups.map((group) => group.restaurant.id)))}>Expand all</button>
              <button className="admin-text-button" type="button" onClick={() => setExpanded(new Set())}>Collapse all</button>
            </>
          )}
          <span className="result-count">{totalItems} assets · {groups.length} restaurants</span>
        </div>

        <LoadState loading={loading} error={error} onRetry={() => { equipment.reload(); restaurants.reload() }} />
        {!loading && !error && groups.length === 0 && (
          <div className="empty-table">{filtering ? 'No equipment matches your filters.' : 'No restaurants yet.'}</div>
        )}

        {!loading && !error && groups.map((group) => {
          const { restaurant } = group
          const open = isOpen(restaurant.id)
          return (
            <div key={restaurant.id} className={`restaurant-group ${open ? 'restaurant-group-open' : ''}`}>
              <div className="restaurant-group-head">
                <button
                  type="button"
                  className="restaurant-group-toggle"
                  onClick={() => toggle(restaurant.id)}
                  aria-expanded={open}
                  aria-controls={`equipment-${restaurant.id}`}
                  disabled={filtering}
                >
                  {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  <span className="business-avatar compact-avatar">{restaurant.legal_name.slice(0, 1)}</span>
                  <span className="restaurant-group-name">
                    <strong>
                      {restaurant.legal_name}
                      {group.attention > 0 && (
                        <span className="attention-dot" title={`${group.attention} need attention`}>
                          <span className="sr-only">{group.attention} need attention</span>
                        </span>
                      )}
                    </strong>
                    <small>{restaurant.city || 'No city'}</small>
                  </span>
                  <span className="restaurant-group-meta">
                    <span>{group.items.length} {group.items.length === 1 ? 'asset' : 'assets'}</span>
                    {group.attention > 0 && <span className="restaurant-group-attention">{group.attention} need attention</span>}
                    <span className="muted-value">{group.nextDue ? `Next ${formatDate(new Date(group.nextDue).toISOString())}` : 'Nothing scheduled'}</span>
                  </span>
                </button>
                <div className="restaurant-group-actions">
                  <button className="row-button" type="button" onClick={() => setAddingFor(restaurant.id)}>
                    <Plus size={13} /> Add
                  </button>
                  <Link className="row-button" to={`/restaurants/${restaurant.id}`} title="Open restaurant">
                    <ExternalLink size={13} /> Open
                  </Link>
                </div>
              </div>

              {open && (
                <div id={`equipment-${restaurant.id}`} className="restaurant-group-body">
                  {group.items.length === 0 ? (
                    <div className="empty-table">No equipment yet. Use “Add” after the on-site assessment.</div>
                  ) : (
                    <EquipmentTable rows={group.items} onChanged={equipment.reload} showRestaurant={false} sort={sort} onSortChange={setSort} />
                  )}
                </div>
              )}
            </div>
          )
        })}
      </section>

      {addingFor !== null && restaurants.data && (
        <AddEquipmentModal
          restaurants={restaurants.data}
          defaultRestaurant={addingFor}
          onClose={() => setAddingFor(null)}
          onSaved={() => {
            if (addingFor) setExpanded(new Set([...openIds, addingFor]))
            setAddingFor(null)
            equipment.reload()
          }}
        />
      )}
    </>
  )
}
