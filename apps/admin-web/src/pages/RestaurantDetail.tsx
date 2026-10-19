import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { ArrowLeft, Plus } from 'lucide-react'
import { AddEquipmentModal } from '../components/AddEquipmentModal'
import { EquipmentTable, equipmentSelect, equipmentState, sortByDue } from '../components/EquipmentTable'
import { LeadsTable, leadSelect } from '../components/LeadsTable'
import { LoadState, PageHeading, StatusLabel } from '../components/ui'
import { formatDate } from '../lib/format'
import { supabase } from '../lib/supabase'
import type { EquipmentRow, LeadRow, Profile } from '../lib/types'
import { useQuery } from '../lib/useQuery'

type RestaurantDetailRow = {
  id: string
  legal_name: string
  cui: string | null
  city: string | null
  county: string | null
  address_line_1: string | null
  address_line_2: string | null
  created_at: string
  owner: Pick<Profile, 'email' | 'full_name' | 'phone'> | null
}

export function RestaurantDetail() {
  const { id = '' } = useParams()
  const [adding, setAdding] = useState(false)

  const restaurant = useQuery(async () => {
    const { data, error } = await supabase
      .from('restaurants')
      .select('id, legal_name, cui, city, county, address_line_1, address_line_2, created_at, owner:profiles(email, full_name, phone)')
      .eq('id', id)
      .maybeSingle<RestaurantDetailRow>()
    if (error) throw error
    if (!data) throw new Error('Restaurant not found.')
    return data
  }, [id])

  const equipment = useQuery(async () => {
    const { data, error } = await supabase
      .from('equipment_items')
      .select(equipmentSelect)
      .eq('restaurant_id', id)
      .neq('status', 'retired')
      .neq('alert_events.status', 'resolved')
      .order('delivered_at', { referencedTable: 'alert_events', ascending: false })
      .returns<EquipmentRow[]>()
    if (error) throw error
    return sortByDue(data)
  }, [id])

  const leads = useQuery(async () => {
    const { data, error } = await supabase
      .from('consultation_leads')
      .select(leadSelect)
      .eq('restaurant_id', id)
      .order('created_at', { ascending: false })
      .returns<LeadRow[]>()
    if (error) throw error
    return data
  }, [id])

  const backLink = <Link className="admin-text-button back-link" to="/restaurants"><ArrowLeft size={14} /> All restaurants</Link>

  if (!restaurant.data) {
    return (
      <>
        {backLink}
        <LoadState loading={restaurant.loading} error={restaurant.error} onRetry={restaurant.reload} />
      </>
    )
  }

  const info = restaurant.data
  const attention = equipment.data?.filter((item) => equipmentState(item).attention).length ?? 0
  const address = [info.address_line_1, info.address_line_2, info.city, info.county].filter(Boolean).join(', ')

  return (
    <>
      {backLink}
      <PageHeading
        eyebrow="RESTAURANT"
        title={info.legal_name}
        description={`Customer since ${formatDate(info.created_at)}`}
        action={
          <button className="admin-primary-button" type="button" onClick={() => setAdding(true)}>
            <Plus size={16} /> Add equipment
          </button>
        }
      />

      <section className="admin-panel detail-panel">
        <dl className="detail-grid">
          <div><dt>CUI</dt><dd className="cui-cell">{info.cui || 'Not added'}</dd></div>
          <div><dt>ADDRESS</dt><dd>{address || 'Not set'}</dd></div>
          <div><dt>CONTACT</dt><dd>{info.owner?.full_name || '—'}</dd></div>
          <div><dt>EMAIL</dt><dd>{info.owner?.email ? <a href={`mailto:${info.owner.email}`}>{info.owner.email}</a> : '—'}</dd></div>
          <div><dt>PHONE</dt><dd>{info.owner?.phone ? <a href={`tel:${info.owner.phone}`}>{info.owner.phone}</a> : '—'}</dd></div>
          <div>
            <dt>ACCOUNT</dt>
            <dd>{equipment.data?.length ? <StatusLabel label="Active" /> : <StatusLabel label="Setup pending" />}</dd>
          </div>
        </dl>
      </section>

      <section className="admin-panel">
        <div className="admin-section-head">
          <div>
            <div className="admin-section-kicker">DIGITAL INVENTORY</div>
            <h2>Equipment ({equipment.data?.length ?? '–'})</h2>
          </div>
          {attention > 0 && <StatusLabel label={`${attention} need attention`} tone="overdue" />}
        </div>
        <LoadState loading={equipment.loading} error={equipment.error} onRetry={equipment.reload} />
        {equipment.data && <EquipmentTable rows={equipment.data} onChanged={equipment.reload} showRestaurant={false} />}
      </section>

      <section className="admin-panel">
        <div className="admin-section-head">
          <div>
            <div className="admin-section-kicker">ADVISORY PIPELINE</div>
            <h2>Purchase requests ({leads.data?.length ?? '–'})</h2>
          </div>
        </div>
        <LoadState loading={leads.loading} error={leads.error} onRetry={leads.reload} />
        {leads.data && <LeadsTable rows={leads.data} onChanged={leads.reload} />}
      </section>

      {adding && (
        <AddEquipmentModal
          restaurants={[{ id: info.id, legal_name: info.legal_name, city: info.city }]}
          defaultRestaurant={info.id}
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
