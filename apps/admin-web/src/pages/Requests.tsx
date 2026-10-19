import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { LeadsTable, leadSelect, leadStatuses } from '../components/LeadsTable'
import { LoadState, PageHeading } from '../components/ui'
import { supabase } from '../lib/supabase'
import type { LeadRow } from '../lib/types'
import { useQuery } from '../lib/useQuery'

export function Requests() {
  const [search, setSearch] = useState('')

  const leads = useQuery(async () => {
    const { data, error } = await supabase
      .from('consultation_leads')
      .select(leadSelect)
      .order('created_at', { ascending: false })
      .returns<LeadRow[]>()
    if (error) throw error
    return data
  }, [])

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return (leads.data ?? []).filter((lead) =>
      `${lead.equipment_type} ${lead.restaurants?.legal_name ?? ''} ${lead.restaurants?.city ?? ''} ${lead.author?.email ?? ''}`.toLowerCase().includes(query),
    )
  }, [leads.data, search])

  return (
    <>
      <PageHeading
        eyebrow="ADVISORY PIPELINE"
        title="Purchase requests"
        description="Consultation requests sent from the mobile app. Call the restaurant, then move the request forward."
      />

      <section className="request-flow">
        {leadStatuses.map((status, index) => (
          <div key={status.value} style={{ display: 'contents' }}>
            {index > 0 && <i />}
            <div>
              <strong>{leads.data?.filter((lead) => lead.status === status.value).length ?? '–'}</strong>
              <span>{status.label}</span>
            </div>
          </div>
        ))}
      </section>

      <section className="admin-panel directory-panel">
        <div className="directory-toolbar">
          <label className="admin-search">
            <Search size={16} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search equipment, restaurant, email" />
          </label>
          <span className="result-count">{filtered.length} requests</span>
        </div>
        <LoadState loading={leads.loading} error={leads.error} onRetry={leads.reload} />
        {leads.data && <LeadsTable rows={filtered} onChanged={leads.reload} />}
      </section>
    </>
  )
}
