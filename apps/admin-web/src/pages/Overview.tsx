import { useState } from 'react'
import { Link } from 'react-router'
import { ArrowRight, Building2, CircleAlert, FileText, Wrench } from 'lucide-react'
import { EquipmentTable, equipmentSelect, equipmentState, sortByDue } from '../components/EquipmentTable'
import { LeadsTable, leadSelect } from '../components/LeadsTable'
import { LoadState, PageHeading } from '../components/ui'
import { supabase } from '../lib/supabase'
import type { EquipmentRow, LeadRow } from '../lib/types'
import { useQuery } from '../lib/useQuery'

export function Overview() {
  const metrics = useQuery(async () => {
    const head = { count: 'exact', head: true } as const
    const results = await Promise.all([
      supabase.from('restaurants').select('id', head),
      supabase.from('consultation_leads').select('id', head).eq('status', 'new'),
      supabase.from('comparison_reports').select('id', head).eq('status', 'published'),
    ])
    const failed = results.find((result) => result.error)
    if (failed?.error) throw failed.error
    const [restaurants, newLeads, publishedReports] = results.map((result) => result.count ?? 0)
    return { restaurants, newLeads, publishedReports }
  }, [])

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

  const leads = useQuery(async () => {
    const { data, error } = await supabase
      .from('consultation_leads')
      .select(leadSelect)
      .order('created_at', { ascending: false })
      .limit(5)
      .returns<LeadRow[]>()
    if (error) throw error
    return data
  }, [])

  const attention = equipment.data?.filter((item) => equipmentState(item).attention) ?? []
  const [today] = useState(() => new Date().toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }).toUpperCase())

  return (
    <>
      <PageHeading eyebrow={today} title="Operations overview" description="Restaurant activity, equipment care, and purchase enquiries." />

      <section className="admin-metrics">
        <article className="admin-metric">
          <div><span>Restaurant accounts</span><Building2 size={17} /></div>
          <strong>{metrics.data?.restaurants ?? '–'}<small> businesses</small></strong>
          <footer><i /> Registered from the mobile app</footer>
        </article>
        <article className="admin-metric metric-attention">
          <div><span>New purchase requests</span><CircleAlert size={17} /></div>
          <strong>{metrics.data?.newLeads ?? '–'}<small> to review</small></strong>
          <footer><ArrowRight size={13} /> Needs first response</footer>
        </article>
        <article className={`admin-metric ${attention.length ? 'metric-attention' : ''}`}>
          <div><span>Equipment needing attention</span><Wrench size={17} /></div>
          <strong>{equipment.data ? attention.length : '–'}<small> of {equipment.data?.length ?? '–'} assets</small></strong>
          <footer><i /> Overdue, due this week, or requested</footer>
        </article>
        <article className="admin-metric">
          <div><span>Comparisons published</span><FileText size={17} /></div>
          <strong>{metrics.data?.publishedReports ?? '–'}<small> reports</small></strong>
          <footer><i /> Visible to customers</footer>
        </article>
      </section>
      <LoadState loading={false} error={metrics.error} onRetry={metrics.reload} />

      <section className="admin-panel">
        <div className="admin-section-head">
          <div><div className="admin-section-kicker">CLEANING ATTENTION</div><h2>Most urgent equipment</h2></div>
          <Link className="admin-text-button" to="/equipment">All equipment <ArrowRight size={14} /></Link>
        </div>
        <LoadState loading={equipment.loading} error={equipment.error} onRetry={equipment.reload} />
        {equipment.data && <EquipmentTable rows={attention.slice(0, 5)} onChanged={equipment.reload} />}
      </section>

      <section className="admin-panel">
        <div className="admin-section-head">
          <div><div className="admin-section-kicker">INCOMING WORK</div><h2>Latest purchase requests</h2></div>
          <Link className="admin-text-button" to="/requests">All requests <ArrowRight size={14} /></Link>
        </div>
        <LoadState loading={leads.loading} error={leads.error} onRetry={leads.reload} />
        {leads.data && <LeadsTable rows={leads.data} onChanged={leads.reload} editable={false} />}
      </section>
    </>
  )
}
