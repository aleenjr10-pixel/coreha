import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { Search } from 'lucide-react'
import { LoadState, PageHeading, StatusLabel } from '../components/ui'
import { formatDate } from '../lib/format'
import { supabase } from '../lib/supabase'
import type { RestaurantRow } from '../lib/types'
import { useQuery } from '../lib/useQuery'

export function Restaurants() {
  const [search, setSearch] = useState('')
  const navigate = useNavigate()

  const restaurants = useQuery(async () => {
    const { data, error } = await supabase
      .from('restaurants')
      .select('id, legal_name, cui, city, created_at, owner:profiles(email, full_name, phone), equipment_items(count), consultation_leads(status)')
      .order('created_at', { ascending: false })
      .returns<RestaurantRow[]>()
    if (error) throw error
    return data
  }, [])

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return (restaurants.data ?? []).filter((item) =>
      `${item.legal_name} ${item.cui ?? ''} ${item.city ?? ''} ${item.owner?.email ?? ''}`.toLowerCase().includes(query),
    )
  }, [restaurants.data, search])

  return (
    <>
      <PageHeading
        eyebrow="CUSTOMER DIRECTORY"
        title="Restaurants"
        description="Restaurants register from the mobile app. Add their equipment after the on-site assessment."
      />
      <section className="admin-panel directory-panel">
        <div className="directory-toolbar">
          <label className="admin-search">
            <Search size={16} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search business, CUI, city, email" />
          </label>
          <span className="result-count">{filtered.length} restaurants</span>
        </div>
        <LoadState loading={restaurants.loading} error={restaurants.error} onRetry={restaurants.reload} />
        {restaurants.data && (
          <div className="table-scroll">
            <table className="admin-table">
              <thead>
                <tr><th>BUSINESS</th><th>CUI</th><th>LOCATION</th><th>ASSETS</th><th>OPEN REQUESTS</th><th>JOINED</th><th>ACCOUNT</th></tr>
              </thead>
              <tbody>
                {filtered.map((item) => {
                  const assets = item.equipment_items[0]?.count ?? 0
                  const openRequests = item.consultation_leads.filter((lead) => lead.status !== 'closed').length
                  return (
                    <tr
                      key={item.id}
                      className="clickable-row"
                      tabIndex={0}
                      aria-label={`Open ${item.legal_name}`}
                      onClick={() => navigate(`/restaurants/${item.id}`)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          navigate(`/restaurants/${item.id}`)
                        }
                      }}
                    >
                      <td>
                        <div className="business-cell">
                          <span className="business-avatar">{item.legal_name.slice(0, 1)}</span>
                          <span><strong>{item.legal_name}</strong><small>{item.owner?.email ?? '—'}</small></span>
                        </div>
                      </td>
                      <td className="cui-cell">{item.cui || 'Not added'}</td>
                      <td>{item.city || 'Not set'}</td>
                      <td>{assets}</td>
                      <td>{openRequests ? <span className="request-count">{openRequests} open</span> : <span className="muted-value">—</span>}</td>
                      <td className="muted-value">{formatDate(item.created_at)}</td>
                      <td>{assets > 0 ? <StatusLabel label="Active" /> : <StatusLabel label="Setup pending" />}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {filtered.length === 0 && <div className="empty-table">No restaurants match your search.</div>}
          </div>
        )}
      </section>
    </>
  )
}
